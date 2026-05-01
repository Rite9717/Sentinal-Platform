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

export const getInstanceMetrics = async (instanceId) => {
  const response = await apiClient.get(`/api/instances/${instanceId}/metrics`);
  return response.data;
};

export const getInstanceSnapshots = async (instanceId) => {
  try {
    const response = await apiClient.get(`/api/instances/${instanceId}/incidents`);
    return response.data;
  } catch (error) {
    console.error('Error fetching instance incident snapshots:', error);
    throw error;
  }
};

export const analyseIncidentSnapshot = async ({ instanceId, snapshotId, prompt, chatHistory = [] }) => {
  try {
    const response = await apiClient.post(`/api/instances/${instanceId}/incidents/${snapshotId}/analyze`, {
      prompt,
      chatHistory,
    });
    return response.data;
  } catch (error) {
    console.error('Error analysing incident snapshot:', error);
    throw error;
  }
};

export const analyseInstance = async ({ instanceId, prompt, chatHistory = [] }) => {
  try {
    const response = await apiClient.post(`/api/instances/${instanceId}/analyze`, {
      prompt,
      chatHistory,
    });
    return response.data;
  } catch (error) {
    console.error('Error analysing instance:', error);
    throw error;
  }
};

export const getIncidentAiSnapshot = async ({ instanceId, snapshotId }) => {
  try {
    const response = await apiClient.get(`/api/instances/${instanceId}/incidents/${snapshotId}/ai-snapshot`);
    return response.data;
  } catch (error) {
    console.error('Error fetching AI snapshot payload:', error);
    throw error;
  }
};
/**
 * Delete a registered instance
 * @param {number} instanceId - The instance ID to delete
 * @returns {Promise<void>}
 */
export const deleteInstance = async (instanceId) => {
  try {
    await apiClient.delete(`/api/instances/${instanceId}`);
  } catch (error) {
    console.error('Error deleting instance:', error);
    throw error;
  }
};

/**
 * Reset instance state to UP
 * @param {number} instanceId - The instance ID to reset
 * @returns {Promise<Object>}
 */
export const resetInstance = async (instanceId) => {
  try {
    const response = await apiClient.post(`/api/instances/${instanceId}/reset`);
    return response.data;
  } catch (error) {
    console.error('Error resetting instance:', error);
    throw error;
  }
};

const ec2Service = {
  registerInstance,
  getUserInstances,
  getInstanceMetrics,
  getInstanceSnapshots,
  getIncidentAiSnapshot,
  analyseIncidentSnapshot,
  analyseInstance,
  deleteInstance,
  resetInstance
};

export default ec2Service;
