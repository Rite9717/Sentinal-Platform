import React, { useState } from 'react';
import './InstanceRegistrationWizard.css';

/**
 * Multi-step wizard for registering AWS EC2 instances
 * Guides users through the IAM role setup process
 */
const InstanceRegistrationWizard = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    instanceId: '',
    region: 'us-east-1',
    nickname: '',
    awsAccountId: ''
  });
  const [roleArn, setRoleArn] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const AWS_REGIONS = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError(null);
    setStep(2);
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const registrationData = {
        instanceId: formData.instanceId,
        region: formData.region,
        nickname: formData.nickname,
        roleArn: roleArn.trim()
      };

      await onComplete(registrationData);
    } catch (err) {
      setError(err.message || 'Failed to register instance');
      setLoading(false);
    }
  };

  const generateCloudFormationTemplate = () => {
    return `AWSTemplateFormatVersion: '2010-09-09'

Parameters:
  ExternalId:
    Type: String
    Description: Unique ID provided by Sentinal

Resources:
  SentinalMonitorRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: SentinalMonitorRole
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              AWS: arn:aws:iam::${formData.awsAccountId}:root
            Action: sts:AssumeRole
            Condition:
              StringEquals:
                sts:ExternalId: !Ref ExternalId
      Policies:
        - PolicyName: SentinalEC2ReadOnly
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - ec2:DescribeInstances
                  - ec2:DescribeInstanceStatus
                  - ec2:RebootInstances
                  - ec2:StopInstances
                  - ec2:StartInstances
                Resource: "*"

Outputs:
  RoleArn:
    Description: "Copy this Role ARN and paste it into Sentinal"
    Value: !GetAtt SentinalMonitorRole.Arn
`;
  };

  const downloadCloudFormationTemplate = () => {
    const template = generateCloudFormationTemplate();
    const blob = new Blob([template], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sentinal-monitor-role.yaml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="wizard-container">
      <div className="wizard-header">
        <h3>Register AWS EC2 Instance</h3>
        <div className="wizard-steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Instance Details</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Complete Registration</div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Step 1: Instance Details */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} className="wizard-form">
          <div className="form-section">
            <h4>Enter your EC2 instance details</h4>
            
            <div className="form-group">
              <label htmlFor="awsAccountId">Your AWS Account ID *</label>
              <input
                type="text"
                id="awsAccountId"
                name="awsAccountId"
                value={formData.awsAccountId}
                onChange={handleInputChange}
                placeholder="123456789012"
                pattern="\d{12}"
                required
                disabled={loading}
              />
              <small>12-digit AWS Account ID</small>
            </div>

            <div className="form-group">
              <label htmlFor="instanceId">Instance ID *</label>
              <input
                type="text"
                id="instanceId"
                name="instanceId"
                value={formData.instanceId}
                onChange={handleInputChange}
                placeholder="i-1234567890abcdef0"
                pattern="i-[a-f0-9]{8,17}"
                required
                disabled={loading}
              />
              <small>Format: i-xxxxxxxxxxxxxxxxx</small>
            </div>

            <div className="form-group">
              <label htmlFor="region">AWS Region *</label>
              <select
                id="region"
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                {AWS_REGIONS.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="nickname">Nickname *</label>
              <input
                type="text"
                id="nickname"
                name="nickname"
                value={formData.nickname}
                onChange={handleInputChange}
                placeholder="My Production Server"
                maxLength="100"
                required
                disabled={loading}
              />
              <small>A friendly name to identify this instance</small>
            </div>
          </div>

          <div className="wizard-actions">
            <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              Next: Setup IAM Role
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Setup IAM Role and Complete Registration */}
      {step === 2 && (
        <div className="wizard-form">
          <div className="form-section">
            <h4>Setup IAM Role in AWS Console</h4>
            
            <div className="info-box highlight">
              <h5>Step 1: Download CloudFormation Template</h5>
              <button 
                type="button" 
                onClick={downloadCloudFormationTemplate}
                className="btn-download"
              >
                📥 Download sentinal-monitor-role.yaml
              </button>
              <small>Template configured for AWS Account: {formData.awsAccountId}</small>
            </div>

            <div className="instructions">
              <h5>Step 2: Create IAM Role in AWS Console</h5>
              <ol>
                <li>
                  <strong>Go to AWS CloudFormation Console</strong>
                  <p>Navigate to: CloudFormation → Create Stack → With new resources</p>
                </li>
                
                <li>
                  <strong>Upload Template</strong>
                  <ul>
                    <li>Select "Choose an existing template"</li>
                    <li>Select "Upload a template file"</li>
                    <li>Upload the <code>sentinal-monitor-role.yaml</code> file</li>
                    <li>Click "Next"</li>
                  </ul>
                </li>
                
                <li>
                  <strong>Configure Stack</strong>
                  <ul>
                    <li>Stack name: <code>SentinalMonitorStack</code></li>
                    <li>ExternalId: <strong>Enter any unique identifier (e.g., your email or company name)</strong></li>
                    <li>Click "Next" → "Next"</li>
                  </ul>
                </li>
                
                <li>
                  <strong>Create Stack</strong>
                  <ul>
                    <li>Check "I acknowledge that AWS CloudFormation might create IAM resources"</li>
                    <li>Click "Submit"</li>
                    <li>Wait for status: <span className="status-success">CREATE_COMPLETE</span></li>
                  </ul>
                </li>
                
                <li>
                  <strong>Get Role ARN</strong>
                  <ul>
                    <li>Click on <code>SentinalMonitorStack</code></li>
                    <li>Go to "Outputs" tab</li>
                    <li>Copy the <strong>RoleArn</strong> value</li>
                    <li>Format: <code>arn:aws:iam::{formData.awsAccountId}:role/SentinalMonitorRole</code></li>
                  </ul>
                </li>
              </ol>
            </div>

            <div className="form-section" style={{ marginTop: '32px' }}>
              <h4>Step 3: Enter Role ARN</h4>
              
              <div className="info-box">
                <p>Paste the Role ARN from your CloudFormation stack outputs.</p>
              </div>

              <form onSubmit={handleStep2Submit}>
                <div className="form-group">
                  <label htmlFor="roleArn">IAM Role ARN *</label>
                  <input
                    type="text"
                    id="roleArn"
                    value={roleArn}
                    onChange={(e) => {
                      setRoleArn(e.target.value);
                      setError(null);
                    }}
                    placeholder={`arn:aws:iam::${formData.awsAccountId}:role/SentinalMonitorRole`}
                    pattern="arn:aws:iam::\d{12}:role\/.+"
                    required
                    disabled={loading}
                  />
                  <small>Format: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME</small>
                </div>

                <div className="info-box">
                  <h5>What happens next?</h5>
                  <ul>
                    <li>✓ We'll verify the IAM role can be assumed</li>
                    <li>✓ We'll test access to your EC2 instance</li>
                    <li>✓ Monitoring will start automatically every 15 seconds</li>
                  </ul>
                </div>

                <div className="wizard-actions">
                  <button 
                    type="button" 
                    onClick={() => setStep(1)} 
                    className="btn-secondary"
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Registering...' : 'Complete Registration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstanceRegistrationWizard;
