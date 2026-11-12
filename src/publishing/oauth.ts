/** OAuth refresh-token exchange; secrets remain in environment, never in output files. */
import type {Transport} from './youtube.js';

export interface YouTubeCredentials {accessToken?:string;clientId?:string;clientSecret?:string;refreshToken?:string}
export async function acquireYouTubeAccessToken(credentials:YouTubeCredentials,transport:Transport=fetch):Promise<string>{
 if(credentials.accessToken?.trim())return credentials.accessToken.trim();
 const {clientId,clientSecret,refreshToken}=credentials;
 if(!clientId?.trim()||!clientSecret?.trim()||!refreshToken?.trim())throw new Error('YouTube needs an access token or OAuth client ID, secret and refresh token');
 const response=await transport('https://oauth2.googleapis.com/token',{
  method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'}).toString(),
 });
 if(response.status!==200)throw new Error(`OAuth refresh failed HTTP ${response.status}`);
 const raw=await response.text();if(raw.length>10000)throw new Error('Oversized OAuth response');
 const body=JSON.parse(raw) as {access_token?:string;token_type?:string;expires_in?:number};
 if(typeof body.access_token!=='string'||!body.access_token||body.access_token.length>8192||body.token_type?.toLowerCase()!=='bearer')
   throw new Error('OAuth refresh response missing bearer access token');
 return body.access_token;
}
export function credentialsFromEnvironment(env:NodeJS.ProcessEnv=process.env):YouTubeCredentials{
 return {accessToken:env.ANYMOTION_YOUTUBE_ACCESS_TOKEN,clientId:env.ANYMOTION_YOUTUBE_CLIENT_ID,
  clientSecret:env.ANYMOTION_YOUTUBE_CLIENT_SECRET,refreshToken:env.ANYMOTION_YOUTUBE_REFRESH_TOKEN};
}
