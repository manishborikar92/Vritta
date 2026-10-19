import { signInWithPopup, signOut, signInWithCustomToken } from 'firebase/auth';
import { auth, googleProvider } from './config';

/**
 * Sign in with Google via Firebase popup.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signInWithGoogle() {
    if (!auth || !googleProvider) {
        throw new Error('Firebase not initialized');
    }
    return signInWithPopup(auth, googleProvider);
}

/**
 * Sign in with a custom token.
 * @param {string} customToken
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function signInWithToken(customToken) {
    if (!auth) {
        throw new Error('Firebase not initialized');
    }
    return signInWithCustomToken(auth, customToken);
}

/**
 * Sign the current user out.
 * @returns {Promise<void>}
 */
export async function logoutUser() {
    if (!auth) return;
    return signOut(auth);
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    window.__vritta_signInWithToken = signInWithToken;
}
