const fs = require('fs');
const path = require('path');
const log4js = require('log4js');
const mongoose = require('mongoose');
const _ = require('lodash');
const cron = require('node-cron');
const storageEngine = require('@appveen/data.stack-utils').storageEngine;

const config = require('./config');
const httpClient = require('./http-client');
const hooksUtils = require('./api/utils/hooks.utils');
const controller = require('./api/utils/common.utils');
const serviceDetails = require('./service.json');

const fileFields = serviceDetails.fileFields;
const logger = log4js.getLogger(global.loggerName);

async function init() {
	global.runInit = true;
	try {
		await hooksUtils.getHooks();
		if (!fs.existsSync(path.join(process.cwd(), 'hooks.json'))) {
			fs.writeFileSync(path.join(process.cwd(), 'hooks.json'), '{"preHooks":[],"experienceHooks":[],"wizard":[],"webHooks":[],"workflowHooks":[]}', 'utf-8');
		}
	} catch (e) {
		logger.error(e);
	}
	return informSM().then(() => GetKeys()).then(() => {
		// global.runInit = false;
	}).catch(err => {
		global.runInit = false;
	});
}

function setDefaultTimezone() {
	try {
		let authorDB = mongoose.connections[1].client.db(config.authorDB);
		authorDB.collection('userMgmt.apps').findOne({ _id: config.app })
			.then(_d => {
				if (!_d) {
					logger.error(`Timezone of ${config.app} :: Unable to find ${config.app}`);
					return;
				}
				logger.trace(`Timezone of ${config.app} :: data :: ${JSON.stringify(_d)}`);
				if (!_d.defaultTimezone) {
					logger.info(`Timezone of ${config.app} :: Not set, switching to data.stack default config`);
					global.defaultTimezone = config.dataStackDefaultTimezone;
					logger.info(`Timezone of ${config.app} : ${config.dataStackDefaultTimezone}`);
					return;
				}
				global.defaultTimezone = _d.defaultTimezone;
				logger.info(`Timezone of ${config.app} : ${global.defaultTimezone}`);
			});
	} catch (err) {
		logger.error(`Timezone of ${config.app} :: ${err.message}`);
	}
}
setDefaultTimezone();

function getFileNames(doc, field) {
	if (!doc) return [];
	let fArr = field.split('.');
	if (fArr.length === 1) {
		if (Array.isArray(doc[fArr])) {
			return doc[fArr].map(_d => _d.filename);
		} else if (doc[fArr] && typeof doc[fArr] === 'object') {
			return [doc[fArr]['filename']];
		}
	}
	let key = fArr.shift();
	if (doc && doc[key]) {
		if (Array.isArray(doc[key])) {
			let arr = doc[key].map(_d => {
				return getFileNames(_d, fArr.join('.'));
			});
			return [].concat.apply([], arr);
		}
		else if (doc[key] && typeof doc[key] === 'object') {
			return getFileNames(doc[key], fArr.join('.'));
		}
	}
}

function startCronJob() {
	cron.schedule('15 2 * * *', clearUnusedFiles);
}
startCronJob();

async function clearUnusedFiles() {
	const batch = 1000;
	const storage = config.connectors.file.type;
	logger.debug('Cron triggered to clear unused file attachment');
	logger.debug(`Storage Enigne - ${storage}`);
	const datefilter = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
	const count = await mongoose.connection.db.collection(`${config.serviceCollection}.files`).count({ 'uploadDate': { '$lte': datefilter } }, { filename: 1 });
	let arr = [];
	let totalBatchCount = count / batch;
	for (let i = 0; i < totalBatchCount; i++) {
		arr.push(i);
	}
	async function reduceHandler(acc, curr, i) {
		try {
			await acc;
			let docs = await mongoose.connection.db.collection(`${config.serviceCollection}.files`).find({ 'uploadDate': { '$lte': datefilter } }, { filename: 1 }).limit(batch).skip(i * batch).toArray();
			let allFilename = docs.map(_d => _d.filename);
			let fileInUse = [];
			docs = await mongoose.model(`${config.serviceId}`).find({}, fileFields.join(' '));
			docs.forEach(_d => {
				fileFields.forEach(_k => {
					fileInUse = fileInUse.concat(getFileNames(_d, _k));
				});
			});
			docs = await global.logsDB.collection(`${config.app}.${config.serviceCollection}.audit`).find({ 'data.old': { $exists: true } }, 'data').toArray();
			docs.forEach(_d => {
				if (_d.data && _d.data.old) {
					fileFields.forEach(_k => {
						fileInUse = fileInUse.concat(getFileNames(_d.data.old, _k));
					});
				}
			});
			fileInUse = fileInUse.filter(_f => _f);
			logger.trace(JSON.stringify({ fileInUse }));
			let filesToBeDeleted = _.difference(allFilename, fileInUse);
			logger.info('Files to be deleted - ', JSON.stringify({ filesToBeDeleted }));

			let promise;
			if (storage === 'GRIDFS') {
				promise = filesToBeDeleted.map(_f => deleteFileFromDB(_f));
			} else if (storage === 'AZBLOB') {
				promise = filesToBeDeleted.map(_f => {
					logger.trace(`Deleting file - ${_f}`);
					let data = {};
					data.filename = `${config.app}/${config.serviceId}_${config.serviceName}/${_f}`;
					data.connectionString = config.connectors.file.AZURE.connectionString;
					data.containerName = config.connectors.file.AZURE.container;

					return new Promise((resolve, reject) => {
						try {
							resolve(storageEngine.azureBlob.deleteFile(data));
						} catch (err) {
							reject(err);
						}
					})
						.then(() => {
							mongoose.connection.db.collection(`${config.serviceCollection}.files`).deleteOne({ filename: _f });
						})
						.catch(err => logger.error(`Error deleting file ${_f} from Azure Blob ${err}`));
				});
			} else if (storage === 'S3') {
				promise = filesToBeDeleted.map(_f => {
					logger.trace(`Deleting file from S3 - ${_f}`);
					let data = {};
					data.fileName = `${config.app}/${config.serviceId}_${config.serviceName}/${_f}`;
					data.accessKeyId = config.connectors.file.S3.accessKeyId;
					data.secretAccessKey = config.connectors.file.S3.secretAccessKey;
					data.region = config.connectors.file.S3.region;
					data.bucket = config.connectors.file.S3.bucket;

					return new Promise((resolve, reject) => {
						try {
							resolve(storageEngine.S3.deleteFile(data));
						} catch (err) {
							reject(err);
						}
					})
						.then(() => {
							mongoose.connection.db.collection(`${config.serviceCollection}.files`).deleteOne({ filename: _f });
						})
						.catch(err => logger.error(`Error deleting file ${_f} from S3 :: ${err}`));
				});
			} else if (storage === 'GCS') {
				let gcsConfigFilePath = path.join(process.cwd(), 'gcs.json');
				promise = filesToBeDeleted.map(_f => {
					logger.trace(`Deleting file from GCS - ${_f}`);
					let data = {};
					data.fileName = `${config.app}/${config.serviceId}_${config.serviceName}/${_f}`;
					data.gcsConfigFilePath = gcsConfigFilePath;
					data.bucket = config.connectors.file.GCS.bucket;
					data.projectId = config.connectors.file.GCS.projectId;

					return new Promise((resolve, reject) => {
						try {
							resolve(storageEngine.GCS.deleteFile(data));
						} catch (err) {
							reject(err);
						}
					})
						.then(() => {
							mongoose.connection.db.collection(`${config.serviceCollection}.files`).deleteOne({ filename: _f });
						})
						.catch(err => logger.error(`Error deleting file ${_f} from GCS :: ${err}`));
				});
			} else {
				logger.error('External Storage type is not allowed');
				throw new Error(`External Storage ${storage} not allowed`);
			}

			return Promise.all(promise);
		} catch (err) {
			logger.error('Error deleting unused files from DB');
		}
	}
	return arr.reduce(reduceHandler, Promise.resolve());
}

function deleteFileFromDB(filename) {
	let gfsBucket = global.gfsBucket;
	return new Promise((resolve, reject) => {
		gfsBucket.find({
			filename: filename
		}).toArray(function (err, result) {
			if (err) {
				logger.error(err);
				reject(err);
			} else {
				gfsBucket.delete(result[0]._id, function (err) {
					if (err) {
						logger.error(err);
						return reject(err);
					} else {
						logger.info('Removed file ' + filename);
						resolve(filename);
					}
				});
			}
		});
	});
}

async function informSM() {
	logger.trace('Ping SM service');
	const options = {
		url: `${config.baseUrlSM}/${config.app}/service/utils/${config.serviceId}/statusChange`,
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		qs: {
			status: 'Active'
		},
		json: true
	};
	return httpClient.httpRequest(options).then(res => {
		if (res.statusCode === 200) {
			let maintenanceInfo = null;
			const body = res.body;
			logger.info('SM status change API called successfully');
			logger.trace('SM status change api response :: ', JSON.stringify(body));
			if (body.status == 'Maintenance') {
				logger.info('Service going into maintenance mode!');
				logger.info(`Maintenance mode :: data :: ${JSON.stringify(maintenanceInfo)}`);
				global.status = 'Maintenance';
				if (body.maintenanceInfo) {
					maintenanceInfo = JSON.parse(body.maintenanceInfo);
					let type = maintenanceInfo.type;
					logger.info(`Maintenance type :: ${type}`);
					if (type == 'purge') {
						logger.info(`Maintenance mode :: related service :: ${JSON.stringify(body.relatedService)}`);
						return controller.bulkDelete(body.relatedService);
					}
				}
			}
			if (body.outgoingAPIs) {
				logger.trace(`Outgoing APIs - ${JSON.stringify({ outgoingAPIs: body.outgoingAPIs })}`);
				global.outgoingAPIs = body.outgoingAPIs;
			}
		} else {
			throw new Error('Service not found');
		}
	}).catch(err => {
		logger.error(`Error pinging SM :: ${err.message}`);
	});
}


async function GetKeys() {
	try {
		logger.trace('Ping USER service');
		const options = {
			url: config.baseUrlUSR + '/' + config.app + '/keys',
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
			json: true
		};
		const res = await httpClient.httpRequest(options);
		if (res.statusCode === 200) {
			const body = res.body;
			global.appEncryptionKey = body.appEncryptionKey;
			global.encryptionKey = body.encryptionKey;
			logger.debug(`Keys for ${config.appNamespace} fetched`);
			logger.trace(`Keys for ${config.appNamespace} : ${JSON.stringify(body)}`);
		} else {
			throw new Error('Service not found');
		}
	} catch (err) {
		logger.error(`Error pinging USER :: ${err.message}`);
	}
}
module.exports = init;