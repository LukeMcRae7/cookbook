/**
 * "Save to cookbook" — a bookmark that runs on the recipe site itself.
 *
 * Recipe sites block other websites from reading their pages, but a bookmarklet
 * runs *on* the site, where it can read the page's own recipe data. It hands
 * that to this app in the URL fragment, which browsers never send to any
 * server — so it stays private and needs no backend.
 */

import { groupResolver, recipeFromHtml, recipeFromText } from './htmlRecipe'
import { findRecipeNode, recipeFromSchema, type Json } from './schemaRecipe'
import { siteLabel } from './detect'
import type { ImportResult } from './types'

export interface BookmarkletPayload {
  /** Page URL */
  u: string
  /** Document title */
  t?: string
  /** The Recipe JSON-LD node, when the page has one */
  r?: Json
  /** og:image */
  i?: string
  /** Microdata markup, when there is no JSON-LD */
  h?: string
  /** Readable text, when there is neither */
  x?: string
  /** [ingredient line, group heading] pairs, as the page displays them */
  g?: [string, string][]
}

/**
 * The script a user saves as a bookmark. Kept ES5 and self-contained: it runs
 * inside whatever page the user is on. It sends only the Recipe node, not the
 * page's whole JSON-LD graph, to keep the URL short.
 */
export function buildBookmarklet(appUrl: string): string {
  const base = appUrl.replace(/#.*$/, '')
  const source = `(function(){
function f(o,d){if(!o||typeof o!='object'||d>8)return null;if(o instanceof Array){for(var i=0;i<o.length;i++){var r=f(o[i],d+1);if(r)return r}return null}
var t=o['@type'];if(t&&/(^|[,/:])recipe(,|$)/i.test(String(t)))return o;return f(o['@graph'],d+1)||f(o.mainEntity,d+1)||null}
var r=null,a=[],s=document.querySelectorAll('script[type="application/ld+json"]');
for(var i=0;i<s.length;i++){try{var j=JSON.parse(s[i].textContent);a.push(j);r=r||f(j,0)}catch(e){}}
function x(o,m,d){if(!o||typeof o!='object'||d>8)return;if(o instanceof Array){for(var i=0;i<o.length;i++)x(o[i],m,d+1);return}
if(o['@id']&&Object.keys(o).length>1&&!m[o['@id']])m[o['@id']]=o;for(var k in o)x(o[k],m,d+1)}
function y(v,m){return v&&v['@id']&&m[v['@id']]?m[v['@id']]:v}
if(r){var m={};x(a,m,0);['author','image'].forEach(function(k){var v=r[k];r[k]=v instanceof Array?v.map(function(z){return y(z,m)}):y(v,m)})}
var c=document.querySelector('.wprm-recipe-ingredients-container,.tasty-recipes-ingredients,.mv-create-ingredients,[class*="recipe-ingredients"]')||document.querySelector('[class*="ingredients"]'),g=[],h='';
if(r&&c)c.querySelectorAll('h2,h3,h4,h5,h6,[class*="group-name"],[class*="group-title"],li').forEach(function(e){var t=e.textContent.replace(/\\s+/g,' ').trim().replace(/:$/,'');if(e.tagName=='LI'){if(h)g.push([t.slice(0,160),h])}else h=/^(ingredients?|equipment|us customary|metric)$/i.test(t)?'':t});
var m=r?null:document.querySelector('[itemtype*="schema.org/Recipe"]');
var o=document.querySelector('meta[property="og:image"]');
var p={u:location.href,t:document.title,r:r,i:o?o.content:'',g:g};
if(m)p.h=m.outerHTML.slice(0,40000);
if(!r&&!m)p.x=(document.querySelector('article,main')||document.body).innerText.slice(0,15000);
window.open(${JSON.stringify(base)}+'#/import?data='+encodeURIComponent(JSON.stringify(p)),'_blank');
})()`
  return `javascript:${encodeURIComponent(source.replace(/\n/g, ''))}`
}

export function decodeBookmarkletPayload(data: string): BookmarkletPayload | undefined {
  try {
    const payload = JSON.parse(data) as BookmarkletPayload
    return typeof payload?.u === 'string' ? payload : undefined
  } catch {
    return undefined
  }
}

export function recipeFromBookmarklet(payload: BookmarkletPayload): ImportResult {
  const fallbacks = { title: payload.t, image: payload.i || undefined }
  const node = findRecipeNode(payload.r ?? null)
  if (node) {
    const pairs = Array.isArray(payload.g) ? payload.g.filter((pair) => Array.isArray(pair) && pair.length === 2) : []
    return recipeFromSchema(node, payload.u, fallbacks, undefined, groupResolver(pairs))
  }
  if (payload.h) return recipeFromHtml(payload.h, payload.u)
  return {
    ...recipeFromText(payload.x ?? '', payload.u, { ...fallbacks, siteName: siteLabel(payload.u) }),
  }
}
