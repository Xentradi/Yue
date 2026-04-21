function isTruthy(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function isCommandDeployEnabled(
  value = process.env.DEPLOY_COMMANDS_ON_STARTUP,
) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return true;
  }

  return isTruthy(value);
}

module.exports = {
  isCommandDeployEnabled,
};
