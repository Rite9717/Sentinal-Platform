import {
  validateUsername,
  validateEmail,
  validatePassword,
  validateFullName
} from './validation';

describe('validateUsername', () => {
  test('returns null for valid username', () => {
    expect(validateUsername('user123')).toBeNull();
    expect(validateUsername('test_user')).toBeNull();
    expect(validateUsername('ABC')).toBeNull();
    expect(validateUsername('a'.repeat(50))).toBeNull();
  });

  test('rejects username shorter than 3 characters', () => {
    expect(validateUsername('ab')).toBe('Username must be at least 3 characters');
    expect(validateUsername('a')).toBe('Username must be at least 3 characters');
    expect(validateUsername('')).toBe('Username must be at least 3 characters');
  });

  test('rejects username longer than 50 characters', () => {
    expect(validateUsername('a'.repeat(51))).toBe('Username must not exceed 50 characters');
  });

  test('rejects username with special characters', () => {
    expect(validateUsername('user@123')).toBe('Username can only contain letters, numbers, and underscores');
    expect(validateUsername('user-name')).toBe('Username can only contain letters, numbers, and underscores');
    expect(validateUsername('user name')).toBe('Username can only contain letters, numbers, and underscores');
    expect(validateUsername('user.name')).toBe('Username can only contain letters, numbers, and underscores');
  });

  test('accepts username with underscores', () => {
    expect(validateUsername('user_name_123')).toBeNull();
    expect(validateUsername('___')).toBeNull();
  });
});

describe('validateEmail', () => {
  test('returns null for valid email', () => {
    expect(validateEmail('test@example.com')).toBeNull();
    expect(validateEmail('user.name@domain.co.uk')).toBeNull();
    expect(validateEmail('a@b.c')).toBeNull();
  });

  test('rejects empty email', () => {
    expect(validateEmail('')).toBe('Email is required');
  });

  test('rejects email longer than 100 characters', () => {
    const longEmail = 'a'.repeat(92) + '@test.com'; // 92 + 9 = 101 characters
    expect(validateEmail(longEmail)).toBe('Email must not exceed 100 characters');
  });

  test('rejects invalid email format', () => {
    expect(validateEmail('notanemail')).toBe('Please enter a valid email address');
    expect(validateEmail('missing@domain')).toBe('Please enter a valid email address');
    expect(validateEmail('@nodomain.com')).toBe('Please enter a valid email address');
    expect(validateEmail('noat.com')).toBe('Please enter a valid email address');
    expect(validateEmail('spaces in@email.com')).toBe('Please enter a valid email address');
  });
});

describe('validatePassword', () => {
  test('returns null for valid password', () => {
    expect(validatePassword('password123')).toBeNull();
    expect(validatePassword('a'.repeat(8))).toBeNull();
    expect(validatePassword('a'.repeat(100))).toBeNull();
  });

  test('rejects password shorter than 8 characters', () => {
    expect(validatePassword('pass')).toBe('Password must be at least 8 characters');
    expect(validatePassword('1234567')).toBe('Password must be at least 8 characters');
    expect(validatePassword('')).toBe('Password must be at least 8 characters');
  });

  test('rejects password longer than 100 characters', () => {
    expect(validatePassword('a'.repeat(101))).toBe('Password must not exceed 100 characters');
  });
});

describe('validateFullName', () => {
  test('returns null for valid full name', () => {
    expect(validateFullName('John Doe')).toBeNull();
    expect(validateFullName('AB')).toBeNull();
    expect(validateFullName('a'.repeat(100))).toBeNull();
  });

  test('rejects full name shorter than 2 characters', () => {
    expect(validateFullName('A')).toBe('Full name must be at least 2 characters');
    expect(validateFullName('')).toBe('Full name must be at least 2 characters');
  });

  test('rejects full name longer than 100 characters', () => {
    expect(validateFullName('a'.repeat(101))).toBe('Full name must not exceed 100 characters');
  });

  test('accepts full name with spaces and special characters', () => {
    expect(validateFullName('John O\'Brien')).toBeNull();
    expect(validateFullName('Mary-Jane Watson')).toBeNull();
    expect(validateFullName('José García')).toBeNull();
  });
});
