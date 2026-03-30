import apiClient from './apiClient';

/**
 * EC2 service for instance registration and monitoring
 */

/**
 * Register a new EC2 instance for monitoring
 * @param {Object} instanceData - Instance registration data
 * @param {string} instanceData.instanceId - EC2 instance ID
 * @param {string} instanceData.region - AWS region
 * @param {string} instanceData.nickname - Friendly name for the instance
 * @param {string} instanceData.roleArn - IAM role ARN for monitoring
 * @returns {Promise<Object>} Registered instance entity
 */
export const registerInstance = async (instanceData) => {
  try {
    const response = await apiClient.post('/api/instances/register', instanceData);
    return response.data;
  } catch (error) {
    console.error('Error registering instance:', error);
    throw error;
  }
};

/**
 * Fetch all registered instances for the current user
 * @returns {Promise<Array>} Array of registered instances
 */
export const getUserInstances = async () => {
  try {
    const response = await apiClient.get('/api/instances');
    return response.data;
  } catch (error) {
    console.error('Error fetching user instances:', error);
    throw error;
  }
};

const ec2Service = {
  registerInstance,
  getUserInstances
};

export default ec2Service;
