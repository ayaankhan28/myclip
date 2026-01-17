// Utility functions for the WebRTC app

/**
 * Generate a random 6-digit code
 */
export const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Get local IP address (simplified for mobile)
 * Note: On mobile, we'll need to get this from the network info
 */
export const getLocalIP = async () => {
  try {
    // For mobile, we'll just return a placeholder
    // In production, you'd use react-native-network-info or similar
    return 'Check device network settings';
  } catch (error) {
    return 'Unable to get IP';
  }
};

/**
 * Format timestamp for messages
 */
export const formatTime = (date = new Date()) => {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

/**
 * Validate room code format
 */
export const isValidRoomCode = (code) => {
  return /^\d{6}$/.test(code);
};

/**
 * Validate IP address format
 */
export const isValidIP = (ip) => {
  if (ip === 'localhost') return true;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return ipRegex.test(ip);
};
