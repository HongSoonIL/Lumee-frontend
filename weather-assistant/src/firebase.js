// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyA0nMyC0rIQi0T2KpzA6pcISY1ZwFGppt4",
    authDomain: "lumee-f1946.firebaseapp.com",
    projectId: "lumee-f1946",
    storageBucket: "lumee-f1946.firebasestorage.app",
    messagingSenderId: "107711364560",
    appId: "1:107711364560:web:7603b6921b2e668898cdd5",
    measurementId: "G-QYBVXR0G8L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 로그인 함수
export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        console.error("Error signing in with Google", error);
        return null;
    }
};

// 로그아웃 함수
export const logout = async () => {
    await signOut(auth);
};