import { Redirect } from 'expo-router';

/** Gerbang rute mengarah ke grup (auth) saat belum login; titik masuknya adalah layar email. */
export default function AuthIndex() {
  return <Redirect href="/masuk" />;
}
