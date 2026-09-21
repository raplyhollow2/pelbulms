package bt.pelbu.lms

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Native Google account picker (Credential Manager). This is the same UI
 * Coursera / Udemy / YouTube use on Android — it lists every Google account
 * on the device, not only accounts signed into Chrome.
 */
class GoogleSignInHelper(
    private val activity: MainActivity,
) {
    private val credentialManager = CredentialManager.create(activity)

    suspend fun requestIdToken(): String {
        return try {
            requestWith(signInWithGoogleRequest())
        } catch (cancelled: GetCredentialCancellationException) {
            throw cancelled
        } catch (_: NoCredentialException) {
            requestWith(allAccountsRequest())
        } catch (_: Exception) {
            requestWith(allAccountsRequest())
        }
    }

    private suspend fun requestWith(request: GetCredentialRequest): String {
        val result = credentialManager.getCredential(
            context = activity,
            request = request,
        )
        val credential = result.credential
        if (credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            val google = GoogleIdTokenCredential.createFrom(credential.data)
            val token = google.idToken
            if (token.isBlank()) {
                throw IllegalStateException("Google did not return an ID token")
            }
            return token
        }
        throw IllegalStateException("Unexpected Google credential type")
    }

    private fun signInWithGoogleRequest(): GetCredentialRequest {
        val option = GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .build()
        return GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build()
    }

    private fun allAccountsRequest(): GetCredentialRequest {
        val option = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setAutoSelectEnabled(false)
            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .build()
        return GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build()
    }
}
