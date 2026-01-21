import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.PUBLIC_FIREBASE_APP_ID
};

if (import.meta.env.DEV) {
    console.log('Firebase Config Check:', {
        hasApiKey: !!firebaseConfig.apiKey,
        hasAuthDomain: !!firebaseConfig.authDomain,
        hasProjectId: !!firebaseConfig.projectId,
        hasStorageBucket: !!firebaseConfig.storageBucket,
        hasMessagingSenderId: !!firebaseConfig.messagingSenderId,
        hasAppId: !!firebaseConfig.appId,
        allEnvKeys: Object.keys(import.meta.env).filter(key => key.startsWith('PUBLIC_') || key.startsWith('VITE_')),
        importMetaEnv: import.meta.env
    });
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    const missing = [];
    if (!firebaseConfig.apiKey) missing.push('PUBLIC_FIREBASE_API_KEY');
    if (!firebaseConfig.projectId) missing.push('PUBLIC_FIREBASE_PROJECT_ID');
    if (!firebaseConfig.authDomain) missing.push('PUBLIC_FIREBASE_AUTH_DOMAIN');
    
    throw new Error(
        `Firebase configuration is missing. Missing variables: ${missing.join(', ')}. ` +
        `Please check your .env file. In Astro, client-side variables must use PUBLIC_ prefix.`
    );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
