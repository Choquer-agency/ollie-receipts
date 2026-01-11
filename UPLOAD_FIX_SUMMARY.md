# Multi-Document Upload 401 Error Fix

## Problem Summary
When uploading 5 documents at once, you encountered 401 (Unauthorized) errors. The console showed:
- `Failed to update receipt: Se` with 401 status
- `Error checking duplicates` with 401 status
- `File upload error` with 401 status
- Multiple `ERR_INTERNET_DISCONNECTED` and `ERR_NAME_NOT_RESOLVED` errors for Clerk token refresh

## Root Cause
1. **Expired/Invalid Auth Token**: Your authentication token expired or became invalid during the upload process
2. **No Token Refresh Before Upload**: The upload component didn't refresh the token before starting the batch upload
3. **No Automatic Retry on 401**: When API calls failed with 401, there was no mechanism to automatically refresh the token and retry

## Solution Implemented

### 1. Added Token Refresh in Upload Component (`ReceiptUpload.tsx`)
- Added `useAuth` hook to access Clerk's `getToken()` method
- Created `refreshAuthToken()` helper function
- Calls `refreshAuthToken()` before starting batch upload to ensure fresh token
- This prevents 401 errors from happening in the first place

### 2. Added Automatic Token Refresh on 401 (`apiService.ts`)
- Added `setTokenRefreshCallback()` to register a token refresh function
- Added Axios response interceptor that:
  - Detects 401 errors
  - Automatically refreshes the token
  - Retries the failed request with new token
- This provides a safety net if token expires during upload

### 3. Configured Token Refresh in App Component (`App.tsx`)
- Set up token refresh callback on component mount
- Ensures the API service can refresh tokens when needed

### 4. Improved Error Tracking
- Added `errors` counter to upload stats
- Shows user how many uploads failed
- Better visibility into upload issues

## How It Works Now

When you upload 5 documents:

1. **Before Upload Starts**: Fresh token is obtained from Clerk
2. **During Upload**: Each API call uses the fresh token
3. **If Token Expires**: 
   - API detects 401 error
   - Automatically gets new token
   - Retries the request
   - Upload continues seamlessly
4. **User Feedback**: Clear stats show successful uploads, duplicates, and any errors

## Testing Recommendations

1. **Test with single file**: Upload 1 document to verify basic functionality
2. **Test with 5+ files**: Upload 5+ documents to test batch processing
3. **Test with old session**: Leave app open for 1+ hour, then upload (tests token refresh)
4. **Check console**: Verify no more 401 errors appear

## Network Issues Note

The numerous `ERR_INTERNET_DISCONNECTED` errors suggest your internet connection may have been unstable during the original upload. The new error tracking will help identify if failures are due to:
- Authentication issues (401 errors - now fixed)
- Network issues (connection errors - will show as "failed to upload")

