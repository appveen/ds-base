
'use strict';

if (process.env.NODE_ENV != 'production') {
	require('dotenv').config();
}

const express = require('express');

const log4js = require('log4js');

const mongoose = require('mongoose');
mongoose.set('useFindAndModify', false);

const config = require('./config');

let LOGGER_NAME = config.isK8sEnv() ? `[${config.appNamespace}] [${config.hostname}] [${config.serviceId}]` : `[${config.serviceId}]`;
global.loggerName = LOGGER_NAME;
const LOG_LEVEL = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';
global.LOG_LEVEL = LOG_LEVEL;

log4js.configure({
	appenders: { out: { type: 'stdout', layout: { type: 'basic' } } },
	categories: { default: { appenders: ['out'], level: LOG_LEVEL } }
});

const logger = log4js.getLogger(LOGGER_NAME);
global.logger = logger;
logger.info(`Service ID : ${config.serviceId}`);
logger.info(`Base image version : ${process.env.IMAGE_TAG}`);

let timeOut = process.env.API_REQUEST_TIMEOUT || 120;
logger.debug(`API_REQUEST_TIMEOUT : ${timeOut}`);

const app = express();

(async () => {
	await require('./db-factory').init();
	// REASSING LOGGER AS THE LOGGER NAME WAS UPDATED INSIDE DB-FACTORY
	const logger = global.logger;
	// Get the updated configs
	const config = require('./config');
	const PORT = config.servicePort;
	require('./initializeRuntime')(app);

	const queueMgmt = require('./queue');

	const dataServiceEndpoint = `/${config.app}${config.serviceEndpoint}`;
	app.use(dataServiceEndpoint, require('./api/controllers'));
	const server = app.listen(PORT, (err) => {
		if (!err) {
			logger.info('Server started on port ' + PORT);
			queueMgmt.client.on('connect', function () {
				require('./init')();
			});
		} else {
			logger.error(err);
			process.exit(0);
		}
	});

	server.setTimeout(parseInt(timeOut) * 1000);

	process.on('SIGTERM', () => {
		try {
			// Handle Request for 15 sec then stop recieving
			setTimeout(() => {
				global.stopServer = true;
			}, 15000);
			logger.info('Process Kill Request Recieved');
			// Stopping CRON Job;
			global.job.cancel();
			const intVal = setInterval(() => {
				// Waiting For all pending requests to finish;
				if (global.activeRequest === 0) {
					// Closing Express Server;
					server.close(() => {
						logger.info('Server Stopped.');
						if (mongoose.connection) {
							mongoose.connection.close(false, (err) => {
								if (err) {
									logger.error('MongoDB connection close', err);
								} else {
									logger.info('MongoDB connection closed.');
								}
								process.exit(0);
							});
						} else {
							process.exit(0);
						}
					});
					clearInterval(intVal);
				} else {
					logger.info('Waiting for request to complete, Active Requests:', global.activeRequest);
				}
			}, 2000);
		} catch (e) {
			logger.error('SIGTERM Handler', e);
			process.exit(0);
		}
	});

})();



