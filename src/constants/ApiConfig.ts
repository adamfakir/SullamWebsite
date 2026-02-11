/**
 * API Configuration
 * 
 * HOW TO USE:
 * 1. Change MODE below to switch between environments
 * 2. Import in your files: import { BASE_URL } from '../constants/ApiConfig';
 * 3. Use in API calls: axios.get(`${BASE_URL}/your/endpoint`)
 * 
 * AVAILABLE MODES:
 * - 'local': For local development (your computer)
 * - 'dev': For development/staging server
 * - 'prod': For production server
 */

// ⚠️ CHANGE THIS TO SWITCH ENVIRONMENTS ⚠️
// Set to 'local', 'dev', or 'prod'
type Environment = 'local' | 'dev' | 'prod';
const MODE: Environment = 'prod';

const BASE_URL_MAP: Record<Environment, string> = {
    local: 'http://192.168.40.236:5002',
    dev: 'http://137.184.168.251',
    prod: 'https://sulamserverbackend-cd7ib.ondigitalocean.app'
};

const BASE_URL = BASE_URL_MAP[MODE];

// Export the BASE_URL for use in other files
// Usage example: await axios.get(`${BASE_URL}/user/login`)
export { BASE_URL };









