import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User as UserType } from './types';

/**
 * Registra un nuevo usuario
 */
export async function registerUser(
  email: string, 
  password: string, 
  displayName: string
): Promise<User> {
  try {
    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Actualizar perfil con displayName
    await updateProfile(user, { displayName });

    // Crear documento de usuario en Firestore
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      displayName,
      email,
      groups: [],
      createdAt: serverTimestamp()
    });

    return user;
  } catch (error: any) {
    throw new Error(error.message || 'Error al registrar usuario');
  }
}

/**
 * Inicia sesión con email y contraseña
 */
export async function loginUser(email: string, password: string): Promise<User> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message || 'Error al iniciar sesión');
  }
}

/**
 * Cierra sesión
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message || 'Error al cerrar sesión');
  }
}

/**
 * Obtiene el usuario actual autenticado
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Observa cambios en el estado de autenticación
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Obtiene los datos del usuario desde Firestore
 */
export async function getUserData(uid: string): Promise<UserType | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserType;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'Error al obtener datos del usuario');
  }
}

/**
 * Actualiza el perfil del usuario
 */
export async function updateUserProfile(uid: string, data: Partial<UserType>): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, data, { merge: true });
  } catch (error: any) {
    throw new Error(error.message || 'Error al actualizar perfil');
  }
}
