/** LLM-assisted cultural adaptation; never changes scene IDs, speakers or timing. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {allDialogue,validateEpisode,type Episode} from '../core/contracts.js';
import {validateLocalization,type Locale,type Localization} from '../audio/dubbing.js';
import {OpenAICompatibleStoryProvider,type StructuredStoryProvider} from './llm.js';

const LOCALIZATION_PROMPT = `You are an expert comedy script localizer. Adapt adult domestic sitcom dialogues from European Spanish to US English. Preserve humor, character identity, romantic warmth and every exact lineId. Output exactly a JSON object with schemaVersion="1.0", episodeId, locale="en-US", lines object keyed by lineId. All source IDs must appear once and no new IDs may be invented. Never add new scenes, actions or dialogue cues. Express jokes naturally, never copy a copyrighted script or meme. A target phrase must fit its source startMs-endMs window in spoken voice; prefer concise idiomatic comedy over literal translations. Output only JSON. No markdown or executable code.`;

export async function createLocalizationDraft(episodeInput:Episode,locale:Locale,provider:StructuredStoryProvider):Promise<Localization>{
  const ep=validateEpisode(episodeInput);
  if(locale!=='en-US')throw new Error('The current automatic localizer only supports en-US');
  const lines=allDialogue(ep).map(line=>({lineId:line.lineId,characterId:line.characterId,startMs:line.startMs,endMs:line.endMs,text:line.text}));
  const response=await provider.generateJson(LOCALIZATION_PROMPT,JSON.stringify({episodeId:ep.episodeId,locale,summary:ep.title,lines}),10000);
  return validateLocalization(response,ep,locale);
}

export async function generateLocalizationFile(episodePath:string,locale:Locale,out:string):Promise<Localization>{
  const model=process.env.ANYMOTION_LLM_MODEL, apiKey=process.env.ANYMOTION_LLM_API_KEY, endpoint=process.env.ANYMOTION_LLM_ENDPOINT;
  if(!model||!apiKey||!endpoint)throw new Error('Missing LLM environment configuration; no API call was made');
  const provider=new OpenAICompatibleStoryProvider({model,apiKey,endpoint});
  const episode=validateEpisode(JSON.parse(await readFile(resolve(episodePath),'utf8')) as unknown);
  const localized=await createLocalizationDraft(episode,locale,provider);
  await writeFile(resolve(out),JSON.stringify(localized,null,2)+'\n',{flag:'wx'});
  return localized;
}
