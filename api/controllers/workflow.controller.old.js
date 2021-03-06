const router = require('express').Router();
const mongoose = require('mongoose');
const log4js = require('log4js');
const _ = require('lodash');

const config = require('../../config');
const workflowUtils = require('../utils/workflow.utils');
const crudderUtils = require('../utils/crudder.utils');
const specialFields = require('../utils/special-fields.utils');

const logger = log4js.getLogger(global.loggerName);
const authorDB = global.authorDB;
const serviceModel = mongoose.model(config.serviceId);
let softDeletedModel;
if (!config.permanentDelete) softDeletedModel = mongoose.model(config.serviceId + '.deleted');
const { modifySecureFieldsFilter, mergeCustomizer } = require('./../utils/common.utils');
// const workflowModel = authorDB.model('workflow');
const workflowModel = mongoose.model('workflow');

/**
 * @deprecated
 */
router.get('/count', (req, res) => {
	async function execute() {
		try {
			let filter = {};
			try {
				if (req.query.filter) {
					filter = JSON.parse(req.query.filter);
					filter = crudderUtils.parseFilter(filter);
					filter = modifySecureFieldsFilter(filter, specialFields.secureFields, false, true);
				}
			} catch (e) {
				logger.error(e);
				return res.status(400).json({
					message: e
				});
			}
			const count = await workflowModel.countDocuments(filter);
			res.status(200).json(count);
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			}
			throw e;
		}
	}
	execute().catch(err => {
		logger.error(err);
		res.status(400).json({
			message: err.message
		});
	});
});

router.get('/users', (req, res) => {
	async function execute() {
		try {
			let txnId = req.get(global.txnIdHeader);
			let filter = req.query.filter ? req.query.filter : {};
			filter = typeof filter === 'string' ? JSON.parse(filter) : filter;
			let wfData = await workflowModel.aggregate([
				{ $match: filter },
				{
					$group: {
						_id: null,
						requestedBy: {
							$addToSet: '$requestedBy'
						},
						respondedBy: {
							$addToSet: '$respondedBy'
						}
					}
				}
			]);

			wfData = wfData[0];
			logger.debug(`${txnId} : WF users wfData :: `, wfData);
			if (wfData) {
				delete wfData._id;
				let users = _.uniq(wfData.requestedBy.concat(wfData.respondedBy));
				let usersCollection = authorDB.collection('userMgmt.users');
				let usersData = await usersCollection.find({ _id: { $in: users } }).project({ '_id': 1, 'basicDetails.name': 1 });
				let userMap = {};
				usersData.forEach(user => userMap[user._id] = user.basicDetails ? user.basicDetails.name : '');
				logger.debug(`${txnId} : users map :: `, userMap);
				wfData.requestedBy = getUsersNameFromMap(userMap, wfData.requestedBy);
				wfData.respondedBy = getUsersNameFromMap(userMap, wfData.respondedBy);
				return res.json(wfData);
			} else {
				return res.json({});
			}
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			}
			throw e;
		}
	}
	execute().catch(err => {
		logger.error(err);
		res.status(400).json({
			message: err.message
		});
	});
});

router.get('/serviceList', (req, res) => {
	async function execute() {
		try {
			const resObj = {};
			resObj[config.serviceId] = 0;
			let filter = req.query.filter;
			if (filter) filter = JSON.parse(filter);
			filter = crudderUtils.parseFilter(filter);
			filter.serviceId = config.serviceId;
			const count = await workflowModel.countDocuments(filter);
			resObj[config.serviceId] = count;
			res.status(200).json(resObj);
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			}
			throw e;
		}
	}
	execute().catch(err => {
		logger.error(err);
		res.status(400).json({
			message: err.message
		});
	});
});

router.get('/', (req, res) => {
	async function execute() {
		try {
			let filter = {};
			try {
				if (req.query.filter) {
					filter = JSON.parse(req.query.filter);
					filter = crudderUtils.parseFilter(filter);
					filter = modifySecureFieldsFilter(filter, specialFields.secureFields, false, true);
				}
			} catch (e) {
				logger.error(e);
				return res.status(400).json({
					message: e
				});
			}
			if (req.query.countOnly) {
				const count = await workflowModel.countDocuments(filter);
				return res.status(200).json(count);
			}
			let skip = 0;
			let count = 30;
			let select = '';
			let sort = '';
			if (req.query.count && (+req.query.count) > 0) {
				count = +req.query.count;
			}
			if (req.query.page && (+req.query.page) > 0) {
				skip = count * ((+req.query.page) - 1);
			}
			if (req.query.select && req.query.select.trim()) {
				select = req.query.select.split(',').join(' ');
			}
			if (req.query.sort && req.query.sort.trim()) {
				sort = req.query.sort.split(',').join(' ') + ' -_metadata.lastUpdated';
			} else {
				sort = '-_metadata.lastUpdated';
			}
			let docs = await workflowModel.find(filter).select(select).sort(sort).skip(skip).limit(count).lean();

			docs = await decryptAndExpandWFItems(docs, req);
			res.status(200).json(docs);
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			}
			throw e;
		}
	}
	execute().catch(err => {
		logger.error(err);
		res.status(400).json({
			message: err.message
		});
	});
});

router.put('/action', (req, res) => {
	async function execute() {
		try {
			if (!req.body.action) {
				return res.status(400).json({ message: 'Action is required.' });
			} else if (req.body.action == 'Discard') {
				return discard(req, res);
			} else if (req.body.action == 'Submit') {
				return submit(req, res);
			} else if (req.body.action == 'Rework') {
				return rework(req, res);
			} else if (req.body.action == 'Approve') {
				return approve(req, res);
			} else if (req.body.action == 'Reject') {
				return reject(req, res);
			} else {
				return res.status(400).json({ message: 'Action is Invalid.' });
			}
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			}
			throw e;
		}
	}
	execute().catch(err => {
		logger.error(err);
		if (err.source) {
			res.status(400).json(err);
		} else {
			res.status(400).json({
				message: err.message
			});
		}
	});
});

router.get('/:id', (req, res) => {
	async function execute() {
		try {
			let doc = await workflowModel.findById(req.params.id).lean();
			if (!doc) {
				return res.status(404).json({
					message: 'Workflow Not Found'
				});
			}
			doc = await decryptAndExpandWFItems(doc, req);
			res.status(200).json(doc);
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			}
			throw e;
		}
	}
	execute().catch(err => {
		logger.error(err);
		res.status(400).json({
			message: err.message
		});
	});
});

router.put('/:id', (req, res) => {
	async function execute() {
		try {
			const id = req.params.id;
			const payload = req.body;
			const remarks = payload.remarks;
			const attachments = payload.attachments;
			const audit = payload.audit;
			const doc = await workflowModel.findOne({ $and: [{ _id: id }, { status: { $in: ['Pending'] } }] });
			if (!doc) {
				return res.status(400).json({ message: 'Workflow to be editted not found' });
			}
			if (audit && Array.isArray(audit) && audit.length > 0) {
				doc.audit = audit;
			}
			if (attachments && Array.isArray(attachments) && attachments.length > 0) {
				doc.attachments = attachments;
			}
			if (remarks) {
				doc.remarks = remarks;
			}
			doc._req = req;
			doc._isEncrypted = true;
			const savedData = await doc.save();
			logger.trace('Workflow Doc Updated', JSON.stringify({ savedData }));
			return res.status(200).json({ message: 'Edit Successful.' });
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			}
			throw e;
		}
	}
	execute().catch(err => {
		logger.error(err);
		if (err.source) {
			res.status(400).json(err);
		} else {
			res.status(400).json({
				message: err.message
			});
		}
	});
});

router.put('/doc/:id', (req, res) => {
	async function execute() {
		try {
			const id = req.params.id;
			const payload = req.body;
			const remarks = payload.remarks;
			const attachments = payload.attachments;
			const newData = payload.data;
			const doc = await workflowModel.findOne({ $and: [{ _id: id }, { status: { $in: ['Draft', 'Rework'] } }] });
			if (!doc) {
				return res.status(400).json({ message: 'Workflow to be editted not found' });
			}
			doc.status = 'Draft';
			const data = await workflowUtils.simulate(req, newData, {
				source: `simulate-workflow ${doc.status} edit`,
				operation: doc.operation
			});
			if (doc.documentId) {
				data._id = doc.documentId;
			}
			doc.data.new = data;
			const auditData = {
				by: 'user',
				action: 'Edit',
				id: req.headers[global.userHeader],
				remarks: remarks,
				attachments: attachments,
				timestamp: Date.now()
			};
			doc.audit.push(auditData);
			doc._req = req;
			const savedData = await doc.save();
			logger.trace(JSON.stringify({ savedData }));
			return res.status(200).json({ message: 'Edit Successful.' });
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			}
			throw e;
		}
	}
	execute().catch(err => {
		logger.error(err);
		if (err.source) {
			res.status(400).json(err);
		} else {
			res.status(400).json({
				message: err.message
			});
		}
	});
});

function getUsersNameFromMap(userMap, userIds) {
	return userIds.map(userId => {
		if (userMap[userId])
			return { _id: userId, name: userMap[userId] };
		else
			return { _id: userId };
	});
}

router.get('/group/:app', (req, res) => {
	async function execute() {
		try {
			let app = req.params.app;
			let filter = req.query.filter;
			try {
				if (filter) {
					filter = JSON.parse(filter);
					filter = crudderUtils.parseFilter(filter);
				}
			} catch (e) {
				logger.error(e);
				filter = {};
			}
			Object.assign(filter, { 'app': app });
			filter['serviceId'] = config.serviceId;
			const data = await workflowModel.aggregate([
				{ '$match': filter },
				{ '$sort': { '_metadata.lastUpdated': 1 } },
				{
					'$group': {
						'_id': '$serviceId',
						'serviceId': { '$first': '$serviceId' }
					}
				},
				{
					'$lookup': {
						'from': 'workflow',
						'localField': '_id',
						'foreignField': 'serviceId',
						'as': 'wf'
					}
				},
				{
					'$project': {
						'wf.operation': 1,
						'wf.status': 1,
						'wf.requestedBy': 1,
						'wf._metadata.lastUpdated': 1
					}
				},
				{ '$sort': { '_metadata.lastUpdated': 1 } }
			]);
			res.json(data);
		} catch (e) {
			if (typeof e === 'string') {
				throw new Error(e);
			}
			throw e;
		}
	}
	execute().catch(err => {
		logger.error(err);
		res.status(400).json({
			message: err.message
		});
	});
});

async function discard(req, res) {
	try {
		const id = req.body.ids[0];
		const doc = await workflowModel.findOne({ $and: [{ _id: id }, { status: { $in: ['Draft', 'Rework'] } }] });
		if (!doc) {
			return res.status(400).json({ message: 'Discard Failed' });
		}
		doc.status = 'Discarded';
		const remarks = req.body.remarks;
		const attachments = req.body.attachments || [];
		const event = {
			by: 'user',
			action: 'Discard',
			id: req.headers[global.userHeader],
			remarks: remarks,
			attachments: attachments,
			timestamp: Date.now()
		};
		if (!doc.audit) {
			doc.audit = [];
		}
		doc.respondedBy = req.headers[global.userHeader];
		doc.audit.push(event);
		doc.markModified('audit');
		doc._req = req;
		doc._isEncrypted = true;
		const savedDoc = await doc.save();
		if (savedDoc.operation == 'PUT') {
			const status = await serviceModel.findOneAndUpdate({ _id: savedDoc.documentId }, { '_metadata.workflow': null }, { new: true });
			logger.debug('Unlocked Document', status);
		}
		return res.status(200).json({ message: 'Discard Successful' });
	} catch (e) {
		logger.error(e);
		return res.status(400).json({ message: e.message });
	}
}

async function submit(req, res) {
	try {
		const id = req.body.ids[0];
		const newData = req.body.data;
		const doc = await workflowModel.findOne({ $and: [{ _id: id }, { status: { $in: ['Draft', 'Rework'] } }] });
		if (!doc) {
			return res.status(400).json({ message: 'Submit Failed' });
		}
		doc.status = 'Pending';
		const remarks = req.body.remarks;
		const attachments = req.body.attachments || [];
		const event = {
			by: 'user',
			action: 'Submit',
			id: req.headers[global.userHeader],
			remarks: remarks,
			attachments: attachments,
			timestamp: Date.now()
		};
		let wfData = doc.data && doc.data.new ? doc.data.new : null;
		if (newData && wfData && !_.isEqual(JSON.parse(JSON.stringify(newData)), JSON.parse(JSON.stringify(wfData)))) {
			event.action = 'Save & Submit';
			doc.data.new = newData;
		}
		if (!doc.audit) {
			doc.audit = [];
		}
		doc.audit.push(event);
		doc.requestedBy = req.headers[global.userHeader];
		doc.markModified('audit');
		doc._req = req;
		doc._isEncrypted = true;
		await doc.save();
		return res.status(200).json({ message: 'Submission Successful' });
	} catch (e) {
		logger.error(e);
		return res.status(400).json({ message: e.message });
	}
}

async function rework(req, res) {
	try {
		const ids = req.body.ids;
		const docs = await workflowModel.find({ $and: [{ _id: ids }, { status: { $in: ['Pending'] } }, { requestedBy: { $ne: req.headers[global.userHeader] } }] });
		if (!docs || docs.length == 0) {
			return res.status(400).json({ message: 'Rework Failed' });
		}
		const approvers = await workflowUtils.getApproversList();
		if (approvers.indexOf(req.headers[global.userHeader]) == -1) {
			return res.status(403).json({ message: 'You Don\'t have Permission to any Action' });
		}
		const remarks = req.body.remarks;
		const attachments = req.body.attachments || [];
		const event = {
			by: 'user',
			action: 'SentForRework',
			id: req.headers[global.userHeader],
			remarks: remarks,
			attachments: attachments,
			timestamp: Date.now()
		};
		const promises = docs.map(doc => {
			doc.status = 'Rework';
			doc.respondedBy = req.headers[global.userHeader];
			if (!doc.audit) {
				doc.audit = [];
			}
			doc.audit.push(event);
			doc.markModified('audit');
			doc._req = req;
			doc._isEncrypted = true;
			return doc.save();
		});
		await Promise.all(promises);
		return res.status(200).json({ message: 'Sent For Changes.' });
	} catch (e) {
		logger.error(e);
		return res.status(400).json({ message: e.message });
	}
}

async function approve(req, res) {
	try {
		const ids = req.body.ids;
		const docs = await workflowModel.find({ $and: [{ _id: ids }, { status: { $in: ['Pending'] } }, { requestedBy: { $ne: req.headers[global.userHeader] } }] });
		if (!docs || docs.length == 0) {
			return res.status(400).json({ message: 'No Documents To Approve' });
		}
		const approvers = await workflowUtils.getApproversList();
		if (approvers.indexOf(req.headers[global.userHeader]) == -1) {
			return res.status(403).json({ message: 'You Don\'t have Permission to any Action' });
		}
		const remarks = req.body.remarks;
		const attachments = req.body.attachments || [];
		const promises = docs.map(async (doc) => {
			let isFailed = false;
			const event = {
				by: 'user',
				action: 'Approved',
				id: req.headers[global.userHeader],
				remarks: remarks,
				attachments: attachments,
				timestamp: Date.now()
			};
			try {
				let serviceDoc;
				const tempReq = _.cloneDeep(req);
				tempReq.headers[global.userHeader] = doc.requestedBy;

				const errors = await specialFields.validateRelation(req, doc.data.new, doc.data.old);
				if (errors) {
					logger.error('Relation Validation Failed:', errors);
					return res.status(400).json({ message: errors });
				}

				await specialFields.decryptSecureFields(req, doc.data.new, null);

				if (doc.operation == 'POST') {
					serviceDoc = new serviceModel(_.cloneDeep(doc.data.new));
					serviceDoc._req = tempReq;
					// serviceDoc._isFromWorkflow = true;
					serviceDoc = await serviceDoc.save();
				} else if (doc.operation == 'PUT') {
					serviceDoc = await serviceModel.findById(doc.documentId);
					serviceDoc._req = tempReq;
					// serviceDoc._isFromWorkflow = true;
					serviceDoc._oldDoc = serviceDoc.toObject();
					delete doc.data.new._metadata;
					_.mergeWith(serviceDoc, doc.data.new, mergeCustomizer);
					serviceDoc._metadata.workflow = null;
					serviceDoc = await serviceDoc.save();
				} else if (doc.operation == 'DELETE') {
					serviceDoc = await serviceModel.findById(doc.documentId);
					serviceDoc._req = tempReq;
					// serviceDoc._isFromWorkflow = true;
					serviceDoc._oldDoc = serviceDoc.toObject();
					if (!config.permanentDelete) {
						let softDeletedDoc = new softDeletedModel(doc);
						softDeletedDoc.isNew = true;
						await softDeletedDoc.save();
					}
					serviceDoc = await serviceDoc.remove();
				}
				doc.status = 'Approved';
				doc.respondedBy = req.headers[global.userHeader];
			} catch (e) {
				let error = e;
				try {
					if (typeof e === 'string') {
						error = JSON.parse(e);
					}
				} catch (parseErr) {
					logger.warn('Error was not a JSON String:', e);
					error = e;
				}
				isFailed = true;
				event.by = 'Entity';
				event.action = 'Process';
				event.remarks = typeof error === 'object' && error.message ? error.message : JSON.stringify(error);
				// doc.status = 'Failed';
				logger.error(e);
			} finally {
				if (!doc.audit) {
					doc.audit = [];
				}
				doc.audit.push(event);
				doc.markModified('audit');
				doc._req = req;
				if (!isFailed) {
					doc._isEncrypted = true;
				}
				// eslint-disable-next-line no-unsafe-finally
				return await doc.save();
			}
		});
		let savedDocs = await Promise.all(promises);
		savedDocs = await decryptAndExpandWFItems(savedDocs, req);
		return res.status(200).json(savedDocs);
	} catch (e) {
		logger.error(e);
		return res.status(400).json({ message: e.message });
	}
}

async function reject(req, res) {
	try {
		const ids = req.body.ids;
		const docs = await workflowModel.find({ $and: [{ _id: ids }, { status: { $in: ['Pending'] } }, { requestedBy: { $ne: req.headers[global.userHeader] } }] });
		if (!docs || docs.length == 0) {
			return res.status(400).json({ message: 'No Documents To Reject' });
		}
		const approvers = await workflowUtils.getApproversList();
		if (approvers.indexOf(req.headers[global.userHeader]) == -1) {
			return res.status(403).json({ message: 'You Don\'t have Permission to any Action' });
		}
		const remarks = req.body.remarks;
		const attachments = req.body.attachments || [];
		const event = {
			by: 'user',
			action: 'Rejected',
			id: req.headers[global.userHeader],
			remarks: remarks,
			attachments: attachments,
			timestamp: Date.now()
		};
		const promises = docs.map(async (doc) => {
			if (doc.operation == 'PUT' || doc.operation == 'DELETE') {
				const status = await serviceModel.findOneAndUpdate({ _id: doc.documentId }, { $unset: { '_metadata.workflow': 1 } }, { new: true });
				logger.debug('Unlocked Document', status);
			}
			doc.status = 'Rejected';
			doc.respondedBy = req.headers[global.userHeader];
			if (!doc.audit) {
				doc.audit = [];
			}
			doc.audit.push(event);
			doc.markModified('audit');
			doc._req = req;
			doc._isEncrypted = true;
			return await doc.save();
		});
		await Promise.all(promises);
		return res.status(200).json({ message: 'Documents Rejected' });
	} catch (e) {
		logger.error(e);
		return res.status(400).json({ message: e.message });
	}
}

async function decryptAndExpandWFItems(wfItems, req) {
	if (wfItems && Array.isArray(wfItems)) {
		// Decrypting secured fields
		if (specialFields.secureFields && specialFields.secureFields.length && specialFields.secureFields[0]) {
			let promises = [];
			wfItems.forEach(e => {
				if (e && e.data && e.data.old)
					promises.push(specialFields.decryptSecureFields(req, e.data.old, null));
				if (e && e.data && e.data.new)
					promises.push(specialFields.decryptSecureFields(req, e.data.new, null));
			});
			await Promise.all(promises);
			promises = null;
		}
		// Expanding Relations
		if (req.query.expand) {
			let promises = [];
			wfItems.forEach(e => {
				if (e && e.data && e.data.old)
					promises.push(specialFields.expandDocument(req, e.data.old, null));
				if (e && e.data && e.data.new)
					promises.push(specialFields.expandDocument(req, e.data.new, null));
			});
			await Promise.all(promises);
			promises = null;
		}
		return wfItems;
	} else {
		wfItems = await decryptAndExpandWFItems([wfItems], req);
		return wfItems[0];
	}
}


module.exports = router;