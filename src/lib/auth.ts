import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, serverTimestamp, query, where, collection } from 'firebase/firestore';
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
      canCreateGroups: false,
      fcmTokens: [],
      lastTokenUpdate: null,
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
 * Obtiene múltiples usuarios en batch usando Promise.all para paralelizar lecturas
 * Más eficiente que hacer lecturas secuenciales
 */
export async function batchGetUsers(uids: string[]): Promise<Map<string, UserType>> {
  const usersMap = new Map<string, UserType>();
  
  // Firestore permite máximo 10 documentos por batch
  const batchSize = 10;
  
  for (let i = 0; i < uids.length; i += batchSize) {
    const batch = uids.slice(i, i + batchSize);
    
    // Usar Promise.all para paralelizar las lecturas (más eficiente que secuencial)
    const userPromises = batch.map(async (uid) => {
      try {
        const userRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          return { uid, data: userDoc.data() as UserType };
        }
        return { uid, data: null };
      } catch {
        return { uid, data: null };
      }
    });
    
    const results = await Promise.all(userPromises);
    results.forEach(({ uid, data }) => {
      if (data) {
        usersMap.set(uid, data);
      }
    });
  }
  
  return usersMap;
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
