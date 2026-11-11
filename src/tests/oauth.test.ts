import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireYouTubeAccessToken} from '../publishing/oauth.js';
import type {Transport} from '../publishing/youtube.js';

test('OAuth requires explicit local credentials and does not expose secrets on provider failures',async()=>{
 await assert.rejects(()=>acquireYouTubeAccessToken({}),/needs an access token/);
 const transport:Transport=async(_url,options)=>{
  assert.equal(options?.method,'POST');
  const body=new URLSearchParams(String(options?.body));
  assert.equal(body.get('refresh_token'),'secret-refresh');
  return new Response('provider rejected token: secret-refresh',{status:401});
 };
 await assert.rejects(()=>acquireYouTubeAccessToken({clientId:'client',clientSecret:'secret',refreshToken:'secret-refresh'},transport),err=>{
   assert.ok(err instanceof Error);assert.equal(err.message,'OAuth refresh failed HTTP 401');return true;
 });
});

test('OAuth refresh obtains bearer token but does not persist it',async()=>{
 const transport:Transport=async()=>new Response(JSON.stringify({access_token:'rotated',token_type:'Bearer',expires_in:3500}),{status:200});
 const result=await acquireYouTubeAccessToken({clientId:'client',clientSecret:'secret',refreshToken:'refresh'},transport);
 assert.equal(result,'rotated');
 assert.equal(await acquireYouTubeAccessToken({accessToken:'direct'}),'direct');
});
