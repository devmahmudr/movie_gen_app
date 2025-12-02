# API Configuration Guide

This guide explains how to configure the API connection for different environments.

## Automatic Configuration

The app automatically detects the environment and uses the appropriate API URL:

- **iOS Simulator**: `http://localhost:3000`
- **Android Emulator**: `http://10.0.2.2:3000` (Android emulator's alias for host machine)
- **Production**: Set via `EXPO_PUBLIC_API_URL` environment variable

## For Physical Devices

When running the app on a physical device (not simulator/emulator), you need to set the API URL to your computer's IP address.

**Your computer's IP address: `192.168.100.115`**

### Option 1: Environment Variable (Recommended)

1. Create a `.env` file in the `mobile` directory:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.100.115:3000
   ```

2. Restart Expo (clear cache if needed):
   ```bash
   npm start -- --clear
   ```

**Note:** Make sure your phone and computer are on the same Wi-Fi network!

### Option 2: Manual Configuration

Edit `mobile/services/apiClient.ts` and replace the `getApiBaseUrl()` function to return your computer's IP address for physical devices.

## Docker Setup

If you're using Docker Compose, the backend is accessible at `http://localhost:3000` from your host machine. The mobile app configuration above still applies.

## Troubleshooting

### Connection Refused Error

1. **Check backend is running:**
   ```bash
   # For Docker
   docker-compose ps
   
   # For manual setup
   cd backend && npm run start:dev
   ```

2. **Check firewall settings:**
   - Ensure port 3000 is not blocked
   - On Mac, check System Preferences > Security & Privacy > Firewall

3. **Verify IP address:**
   - Make sure your phone and computer are on the same Wi-Fi network
   - Use the correct IP address (not localhost)

### Network Error

- Check that both devices are on the same network
- Try pinging your computer's IP from the device
- Check backend logs for incoming requests

### Debug Logging

In development mode, the app logs the API URL being used. Check the console/Expo logs to see:
```
API Base URL: http://...
```

If you see connection errors, they will include helpful hints about configuration.

