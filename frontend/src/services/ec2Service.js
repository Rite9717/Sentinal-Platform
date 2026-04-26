import axios from 'axios';
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
  const token = localStorage.getItem('jwt_token');
  const response = await axios.get(`http://localhost:8080/api/instances/${instanceId}/metrics`, {
    headers: { Authorization: `Bearer ${token}` }
  });
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

export const analyseIncidentSnapshot = async ({ instanceId, snapshotId, prompt }) => {
  try {
    const response = await apiClient.post('/ai/agenticai/analyse', {
      instanceId,
      snapshotId,
      prompt,
    });
    return response.data;
  } catch (error) {
    console.error('Error analysing incident snapshot:', error);
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
  analyseIncidentSnapshot,
  deleteInstance,
  resetInstance
};

export default ec2Service;
