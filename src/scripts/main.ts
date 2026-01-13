/*
  User's make an account and add various tasks that can be ticked off.
  The number of tasks each user can create are limited, and each task can only have a certain number of ticks before they start to be overwritten.
  Other user's with permissions can tick off items from the user A's link.
*/

import { FirebaseError, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  EmailAuthCredential,
  EmailAuthProvider,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

//#region Firebase

const firebaseConfig = {
  apiKey: "AIzaSyCzs0JDCfdenKqb-A_C-a8IFFhY-x_Prow",
  authDomain: "good-girl-7c086.firebaseapp.com",
  projectId: "good-girl-7c086",
  storageBucket: "good-girl-7c086.firebasestorage.app",
  messagingSenderId: "19444071776",
  appId: "1:19444071776:web:9cb5b57c31a2ac5ec3b205",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new EmailAuthProvider();

type UserData = { displayname: string };
const usersCol = collection(db, "users");

let uiAuthHandler = (_user: User | null) => {};
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = doc(usersCol, user.uid);
    const snapshot = await getDoc(userDoc);
    const data = (snapshot?.data() as UserData) || {};
    if (!snapshot.exists()) {
      await setDoc(userDoc, { displayname: "ANONYMOUS" });
    } else if (data.displayname === undefined) {
      await updateDoc(userDoc, { displayname: "ANONYMOUS" });
    }
  }
  uiAuthHandler(user);
});

//#endregion
//#region UI

const authData: {
  authAction?: AUTHACTION;
  email?: string | null;
  password?: string | null;
  confirmPassword?: string | null;
  showPassword?: boolean;
} = {};
function authFormChanged() {
  if (auth.currentUser && authData.authAction !== "sign-out" && authData.authAction !== "delete")
    signOutRadio.checked = true;
  else if (
    !auth.currentUser &&
    (authData.authAction === "sign-out" || authData.authAction === "delete")
  )
    signInRadio.checked = true;

  let formData = new FormData(authForm);
  authData.authAction = formData.get("auth-action") as AUTHACTION;

  signInRadio.disabled = Boolean(auth.currentUser);
  signUpRadio.disabled = Boolean(auth.currentUser);
  signOutRadio.disabled = !auth.currentUser;
  deleteRadio.disabled = !auth.currentUser;

  if (authData.authAction !== currentAuthAction) {
    if (authData.authAction === "sign-out") {
      emailInput.value = "";
    }
    passwordInput.value = "";
    confPassInput.value = "";
    showPasswordCheckbox.checked = false;

    emailInput.disabled = authData.authAction === "sign-out";
    passwordInput.disabled = authData.authAction === "sign-out";
    showPasswordCheckbox.disabled = authData.authAction === "sign-out";
    confPassInput.disabled = authData.authAction !== "sign-up" && authData.authAction !== "delete";

    emailInput.required = authData.authAction !== "sign-out";
    passwordInput.required = authData.authAction !== "sign-out";
    confPassInput.required = authData.authAction === "sign-up" || authData.authAction === "delete";

    passwordInput.autocomplete =
      authData.authAction === "sign-up" || authData.authAction === "delete"
        ? "current-password"
        : "new-password";
    currentAuthAction = authData.authAction;
  }

  formData = new FormData(authForm);
  authData.email = formData.get("email") as string | null;
  authData.password = formData.get("password") as string | null;
  authData.confirmPassword = formData.get("confirm-password") as string | null;
  authData.showPassword = Boolean(formData.get("show-password"));

  passwordInput.type = authData.showPassword ? "text" : "password";
  confPassInput.type = authData.showPassword ? "text" : "password";
  confPassInput.classList.toggle(
    "invalid",
    authData.password !== "" && authData.password !== authData.confirmPassword
  );
}

async function submitAuthForm(e: SubmitEvent) {
  e.preventDefault();
  authSubmitButton.disabled = true;
  if (!authData) return;
  try {
    if (authData.authAction === "sign-in" && authData.email && authData.password) {
      await signInWithEmailAndPassword(auth, authData.email, authData.password);
    } else if (
      authData.authAction === "sign-up" &&
      authData.email &&
      authData.password &&
      authData.password === authData.confirmPassword
    ) {
      await createUserWithEmailAndPassword(auth, authData.email, authData.password);
    } else if (authData.authAction === "sign-out") {
      await signOut(auth);
      signInRadio.checked = true;
      authFormChanged();
    } else if (
      authData.authAction === "delete" &&
      auth.currentUser &&
      authData.email &&
      authData.password &&
      authData.password === authData.confirmPassword
    ) {
      await reauthenticateWithCredential(
        auth.currentUser,
        EmailAuthProvider.credential(authData.email, authData.password)
      );
      const userId = auth.currentUser.uid;
      await deleteDoc(doc(usersCol, userId));
      await auth.currentUser.delete();
    }
  } catch (e) {
    if (e instanceof FirebaseError) {
      if (e.code === "auth/email-already-in-use") {
        // TODO: Make show as text in the auth menu
        return alert(`There is already an account using the email ${authData.email}.`);
      } else if (e.code === "auth/invalid-credential") {
        return alert(`Incorrect email or password.`);
      }
    }
    console.error(e);
  } finally {
    authSubmitButton.disabled = false;
  }
}

uiAuthHandler = (user: User | null) => {
  authForm.classList.toggle("logged-in", Boolean(auth.currentUser));
  authForm.classList.toggle("shown", !user);
  authForm.classList.remove("waiting");
  authFormChanged();
  console.log(`SIGNED ${user ? "IN" : "OUT"}!`);
};

const authScreen = document.querySelector<HTMLDivElement>("#auth-screen")!;
const authForm = authScreen.querySelector<HTMLFormElement>("#auth")!;
const signInRadio = authForm.querySelector<HTMLInputElement>("#sign-in-radio")!;
const signUpRadio = authForm.querySelector<HTMLInputElement>("#sign-up-radio")!;
const signOutRadio = authForm.querySelector<HTMLInputElement>("#sign-out-radio")!;
const deleteRadio = authForm.querySelector<HTMLInputElement>("#delete-radio")!;
const emailInput = authForm.querySelector<HTMLInputElement>("#email")!;
const passwordInput = authForm.querySelector<HTMLInputElement>("#password")!;
const confPassInput = authForm.querySelector<HTMLInputElement>("#confirm-password")!;
const showPasswordCheckbox = authForm.querySelector<HTMLInputElement>("#show-password")!;
const authSubmitButton = authForm.querySelector<HTMLButtonElement>('[type="submit"]')!;
const showAuthScreen = document.querySelector<HTMLButtonElement>("#show-auth-screen")!;

passwordInput.addEventListener("copy", (e) => e.preventDefault());
confPassInput.addEventListener("copy", (e) => e.preventDefault());

type AUTHACTION = "sign-in" | "sign-up" | "sign-out" | "delete";
let currentAuthAction: AUTHACTION | null = null;
authForm.addEventListener("input", authFormChanged);
authForm.addEventListener("submit", submitAuthForm);
authFormChanged();

authScreen.addEventListener("click", (e) => {
  if (e.target === authScreen && auth.currentUser) authForm.classList.remove("shown");
});
showAuthScreen.addEventListener("click", () => {
  authFormChanged();
  authForm.classList.add("shown");
});

//#endregion
