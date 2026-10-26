import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
const browser = await chromium.launch({channel:'msedge', headless:true})
const context = await browser.newContext({viewport:{width:1440,height:1000}})
const page = await context.newPage()
const views=['Overview','Pull requests','Bug reproductions','Slopsquatting','AST Analysis','Execution logs','Configuration','Live Agent Studio']
const phase=process.argv[2] || 'before'
const errors=[]
for(const view of views){
 await page.goto('http://localhost:8443/?tab='+encodeURIComponent(view))
 await page.waitForTimeout(500)
 await page.screenshot({path:`docs/ui-changes/${phase}-${view.replaceAll(' ','-')}.png`,fullPage:true})
 if(phase==='after'){
  const result=await new AxeBuilder({page}).analyze()
  errors.push({view,violations:result.violations.filter(v=>['serious','critical'].includes(v.impact))})
 }
}
fs.writeFileSync(`docs/ui-changes/${phase}-audit.json`,JSON.stringify(errors,null,2))
await browser.close()
console.log('Captured',views.length,'views; serious violations:',errors.reduce((n,v)=>n+v.violations.length,0))

