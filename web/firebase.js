import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyAxf5PGKJDhn0j6UAHFJMINeh7ZnK3No_A',
  authDomain: 'apt-layout.firebaseapp.com',
  projectId: 'apt-layout',
  storageBucket: 'apt-layout.firebasestorage.app',
  messagingSenderId: '974715974830',
  appId: '1:974715974830:web:1e97fbedfeaf3457f8293f',
  measurementId: 'G-DDVNCT0JDF',
  databaseURL: 'https://apt-layout-default-rtdb.firebaseio.com',
}

export const app = initializeApp(firebaseConfig)
export const database = getDatabase(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider)