/** Cross-platform deterministic SVG rasterization; requires no FFmpeg SVG decoder. */
import sharp from 'sharp';

export type RendererBackend='sharp-png-v1'|'svg-ffmpeg-poc';
export function currentRendererBackend():RendererBackend{
 const value=process.env.ANYMOTION_RENDER_BACKEND??'sharp';
 if(value==='sharp')return 'sharp-png-v1';
 if(value==='ffmpeg-svg')return 'svg-ffmpeg-poc';
 throw new Error('ANYMOTION_RENDER_BACKEND must be sharp or ffmpeg-svg');
}
export function sharpAvailability():string{
 if(typeof sharp!=='function'||!sharp.versions.vips)throw new Error('Sharp native image rasterizer unavailable');
 return `sharp ${sharp.versions.sharp}, libvips ${sharp.versions.vips}`;
}
/** Generated SVG comes from our allowlisted compositor, never directly from untrusted model output. */
export async function rasterizeSvgFrame(svg:string,width:number,height:number):Promise<Buffer>{
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<64||height<64||width>4096||height>4096)
  throw new RangeError('Invalid raster dimensions');
 if(typeof svg!=='string'||svg.length>2_000_000||!svg.includes('<svg'))throw new Error('Only a generated SVG frame can be rasterized');
 const {data,info}=await sharp(Buffer.from(svg,'utf8'),{limitInputPixels:width*height*4})
  .png({compressionLevel:1}).toBuffer({resolveWithObject:true});
 if(info.width!==width||info.height!==height||data.length<100||data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
  throw new Error('Rasterizer returned invalid PNG dimensions or bytes');
 return data;
}
