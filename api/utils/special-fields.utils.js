const mongoose = require('mongoose');
const _ = require('lodash');
const moment = require('moment');

const config = require('../../config');
const httpClient = require('../../http-client');
const commonUtils = require('./common.utils');

const logger = global.logger;
const createOnlyFields = ''.split(',');
const precisionFields = [];
const secureFields = ''.split(',');
const uniqueFields = [];
const relationUniqueFields = ''.split(',');
const dateFields = [{"field":"visitDate","dateType":"date","defaultTimezone":"Zulu"}]
/**
 * @param {*} req The Incomming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @param {boolean} [forceRemove] Will remove all createOnly field
 * @returns {object | null} Returns null if no validation error, else and error object with invalid paths
 */
function validateCreateOnly(req, newData, oldData, forceRemove) {
	const errors = {};
	if (oldData) {
	}
	return Object.keys(errors).length > 0 ? errors : null;
}

function mongooseUniquePlugin() {
	return function (schema) {
		schema.index({ "studyId": "text", "siteId": "text", "subjectId": "text", "visitId": "text", "visitRepeatKey": "text", "formId": "text", "formRepeatKey": "text", "itemGroupId": "text", "itemGroupRowId": "text", "itemId": "text", "itemValue": "text" }, { name: 'text_search' });
	}
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function validateUnique(req, newData, oldData) {
	const model = mongoose.model(config.serviceId);
	const errors = {};
	let val;
	return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function validateRelation(req, newData, oldData) {
	const errors = {};
	return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @param {boolean} expandForSelect Expand only for select
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function expandDocument(req, newData, oldData, expandForSelect) {
	const errors = {};
	return newData;
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @param {boolean} expandForSelect Expand only for select
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function cascadeRelation(req, newData, oldData) {
	const errors = {};
	if (!req.query.cascade || req.query.cascade != 'true') {
		return null;
	}
	return null;
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} filter The Filter Object
 * @param {*} errors The errors while fetching RefIds
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function patchRelationInFilter(req, filter, errors) {
	if (!errors) {
		errors = {};
	}
	try {
		if (typeof filter !== 'object') {
			return filter;
		}
		let flag = 0;
		const tempFilter = {};
		let promises = Object.keys(filter).map(async (key) => {
			if (!flag) {
				if (typeof filter[key] == 'object' && filter[key]) {
					if (Array.isArray(filter[key])) {
						const promiseArr = filter[key].map(async (item, i) => {
							return await patchRelationInFilter(req, item, errors);
						});
						tempFilter[key] = (await Promise.all(promiseArr)).filter(e => e ? Object.keys(e).length : 0);
					} else {
						tempFilter[key] = await patchRelationInFilter(req, filter[key], errors);
					}
				} else {
					tempFilter[key] = filter[key]
				}
			}
		});
		promises = await Promise.all(promises);
		promises = null;
		return tempFilter;
	} catch (e) {
		throw e;
	}
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} filter The Filter Object
 * @param {*} errors The errors while fetching RefIds
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function patchRelationInWorkflowFilter(req, filter, errors) {
	if (!errors) {
		errors = {};
	}
	try {
		if (typeof filter !== 'object') {
			return filter;
		}
		let flag = 0;
		const tempFilter = {};
		let promises = Object.keys(filter).map(async (key) => {
			if (!flag) {
				if (typeof filter[key] == 'object' && filter[key]) {
					if (Array.isArray(filter[key])) {
						const promiseArr = filter[key].map(async (item, i) => {
							return await patchRelationInWorkflowFilter(req, item, errors);
						});
						tempFilter[key] = (await Promise.all(promiseArr)).filter(e => e ? Object.keys(e).length : 0);
					} else {
						tempFilter[key] = await patchRelationInWorkflowFilter(req, filter[key], errors);
					}
				} else {
					tempFilter[key] = filter[key]
				}
			}
		});
		promises = await Promise.all(promises);
		promises = null;
		return tempFilter;
	} catch (e) {
		throw e;
	}
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function encryptSecureFields(req, newData, oldData) {
	const errors = {};
	return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function decryptSecureFields(req, newData, oldData) {
	const errors = {};
	return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * @param {*} req The Incoming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
function fixBoolean(req, newData, oldData) {
	const errors = {};
	const trueBooleanValues = global.trueBooleanValues;
	const falseBooleanValues = global.falseBooleanValues;
	return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function enrichGeojson(req, newData, oldData) {
	const errors = {};
	return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * @param {*} req The Incomming Request Object
 * @param {*} newData The New Document Object
 * @param {*} oldData The Old Document Object
 * @returns {Promise<object>} Returns Promise of null if no validation error, else and error object with invalid paths
 */
async function validateDateFields(req, newData, oldData) {
	let txnId = req.headers['txnid'];
	const errors = {};
	let visitDateDefaultTimezone = 'Zulu';
	let visitDateSupportedTimezones = [];
	let visitDateNew = _.get(newData, 'visitDate')
	let visitDateOld = _.get(oldData, 'visitDate')
	if (typeof visitDateNew === 'string') {
		visitDateNew = {
			rawData: visitDateNew
		};
	}
	if (typeof visitDateOld === 'string') {
		visitDateOld = {
			rawData: visitDateOld
		};
	}
	if (!_.isEqual(visitDateNew, visitDateOld)) {
		try {
			visitDateNew = commonUtils.getFormattedDate(txnId, visitDateNew, visitDateDefaultTimezone, visitDateSupportedTimezones);
			_.set(newData, 'visitDate', visitDateNew);
		} catch (e) {
			errors['visitDate'] = e.message ? e.message : e;
		}
	}
	return Object.keys(errors).length > 0 ? errors : null;
}

function hasPermissionForPOST(req, permissions) {
	if (req.user.apps && req.user.apps.indexOf(config.app) > -1) {
		return true;
	}
	if (_.intersection(['ADMIN_SRVC21962'], permissions).length > 0) {
		return true;
	}
	if (_.intersection(["P6733802061"], permissions).length > 0) {
		return true;
	}
	return false;
}
module.exports.hasPermissionForPOST = hasPermissionForPOST;
function hasPermissionForPUT(req, permissions) {
	if (req.user.apps && req.user.apps.indexOf(config.app) > -1) {
		return true;
	}
	if (_.intersection(['ADMIN_SRVC21962'], permissions).length > 0) {
		return true;
	}
	if (_.intersection(["P6733802061"], permissions).length > 0) {
		return true;
	}
	return false;
}
module.exports.hasPermissionForPUT = hasPermissionForPUT;
function hasPermissionForDELETE(req, permissions) {
	if (req.user.apps && req.user.apps.indexOf(config.app) > -1) {
		return true;
	}
	if (_.intersection(['ADMIN_SRVC21962'], permissions).length > 0) {
		return true;
	}
	if (_.intersection(["P6733802061"], permissions).length > 0) {
		return true;
	}
	return false;
}
module.exports.hasPermissionForDELETE = hasPermissionForDELETE;
function hasPermissionForGET(req, permissions) {
	if (req.user.apps && req.user.apps.indexOf(config.app) > -1) {
		return true;
	}
	if (_.intersection(['ADMIN_SRVC21962'], permissions).length > 0) {
		return true;
	}
	if (_.intersection(["P6733802061","P7680752529","P8373673737"], permissions).length > 0) {
		return true;
	}
	return false;
}
module.exports.hasPermissionForGET = hasPermissionForGET;

function filterByPermission(req, permissions, data) {
	if (req.user.apps && req.user.apps.indexOf(config.app) > -1) {
		return data;
	}
	if (_.intersection(['ADMIN_SRVC21962'], permissions).length > 0) {
		return data;
	}
	if (_.intersection([], permissions).length > 0) {
		return data;
	}
	if (_.intersection(["P6733802061","P7680752529","P8373673737"], permissions).length == 0) {
		_.unset(data, '_id');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'studyId');
	}
	if (_.intersection(["P6733802061","P7680752529","P8373673737"], permissions).length == 0) {
		_.unset(data, 'siteId');
	}
	if (_.intersection(["P6733802061","P7680752529","P8373673737"], permissions).length == 0) {
		_.unset(data, 'subjectId');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'visitId');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'visitDate');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'visitRepeatKey');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'formId');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'formRepeatKey');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'itemGroupId');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'itemGroupRowId');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'itemId');
	}
	if (_.intersection(["P6733802061","P7680752529"], permissions).length == 0) {
		_.unset(data, 'itemValue');
	}
		return data;
}


async function getDynamicFilter(req, data) {
	let filter;
	let allFilters = [];
	if (_.intersection(['ADMIN_SRVC21962'], req.user.appPermissions).length > 0) {
		return null;
	}
	if (_.intersection(['P8373673737'], req.user.appPermissions).length > 0) {
	filter = {"siteId":{"$user":"attributes.site"}};
	let var_siteId = _.get(req.user, 'attributes.site');
	if (!var_siteId || _.isEmpty(var_siteId)) {
		var_siteId = {};
	}
	if (var_siteId.type == 'Boolean') {
		_.set(filter, ["siteId"], var_siteId.value);
	} else if(var_siteId.type == 'Date') {
		_.set(filter, ["siteId"], (getDateRangeObject(var_siteId.value) || 'NO_VALUE'));
	} else {
		_.set(filter, ["siteId"], (var_siteId.value || 'NO_VALUE'));
	}
		if (filter && !_.isEmpty(filter)) {
			allFilters.push(filter);
		}
	}
	if (allFilters && allFilters.length > 0) {
		logger.debug('Dynamic Filter Applied', JSON.stringify(allFilters));
		return { $and: allFilters };
	} else {
		logger.debug('Dynamic Filter Not Applied.');
		return null;
	}
}

function getDateRangeObject(date) {
	if (date) {
		const filter = {};
		const temp = moment.utc(date);
		temp.startOf('date');
		filter['$gte'] = temp.utc().format();
		temp.endOf('date');
		filter['$lte'] = temp.utc().format();
		return filter;
	}
	return null;
}
module.exports.createOnlyFields = createOnlyFields;
module.exports.precisionFields = precisionFields;
module.exports.secureFields = secureFields;
module.exports.uniqueFields = uniqueFields;
module.exports.relationUniqueFields = relationUniqueFields;
module.exports.dateFields = dateFields;
module.exports.mongooseUniquePlugin = mongooseUniquePlugin;
module.exports.validateCreateOnly = validateCreateOnly;
module.exports.validateRelation = validateRelation;
module.exports.validateUnique = validateUnique;
module.exports.expandDocument = expandDocument;
module.exports.encryptSecureFields = encryptSecureFields;
module.exports.decryptSecureFields = decryptSecureFields;
module.exports.patchRelationInFilter = patchRelationInFilter;
module.exports.patchRelationInWorkflowFilter = patchRelationInWorkflowFilter;
module.exports.fixBoolean = fixBoolean;
module.exports.enrichGeojson = enrichGeojson;
module.exports.validateDateFields = validateDateFields;
module.exports.cascadeRelation = cascadeRelation;
module.exports.filterByPermission = filterByPermission;
module.exports.getDynamicFilter = getDynamicFilter;