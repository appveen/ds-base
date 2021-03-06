const logger = global.logger;

function dotEnvFile(config) {
	return `
NODE_ENV="development"
MONGO_APPCENTER_URL="${process.env.MONGO_APPCENTER_URL}"
MONGO_AUTHOR_URL="${process.env.MONGO_AUTHOR_URL}"
MONGO_LOGS_URL="${process.env.MONGO_LOGS_URL}"
ODP_APP="${config.app}"
SERVICE_ID="${config._id}"
SERVICE_NAME="${config.name}"
SERVICE_VERSION="${config.version}"
SERVICE_PORT="${config.port}"
SERVICE_ENDPOINT="${config.api}"
SERVICE_COLLECTION="${config.collectionName}"
ID_PADDING="${config.idDetails.padding || ''}"
ID_PREFIX="${config.idDetails.prefix || ''}"
ID_SUFFIX="${config.idDetails.suffix || ''}"
ID_COUNTER="${config.idDetails.counter}"
PERMANENT_DELETE=${config.permanentDeleteData}
HOSTNAME="localhost"
DATA_STACK_APP_NS="appveen-${config.app}"
DATA_STACK_NAMESPACE="appveen"
DATA_STACK_APP="${config.app}"
DATA_STACK_ALLOWED_FILE_TYPE="${config.allowedFileTypes}"
STORAGE_ENGINE="${process.env.STORAGE_ENGINE}"
STORAGE_AZURE_CONNECTION_STRING="${process.env.STORAGE_AZURE_CONNECTION_STRING}"
STORAGE_AZURE_CONTAINER="${process.env.STORAGE_AZURE_CONTAINER}"
STORAGE_AZURE_SHARED_KEY="${process.env.STORAGE_AZURE_SHARED_KEY}"
STORAGE_AZURE_TIMEOUT="${process.env.STORAGE_AZURE_TIMEOUT}"
`;
}

module.exports = {
	dotEnvFile
};
