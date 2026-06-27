/**
 * Generate a PDF + contact-sheet directly from the print HTML.
 * Sidesteps PPTX library quirks — PDF is universally rendered.
 */
const { chromium } = require('playwright');
const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOTAL_SLIDES = 10;
const OUT_DIR = path.join(__dirname, 'deck-output');
const PDF_PATH = path.join(__dirname, 'Sean-Walsh-Listing-Presentation.pdf');
const PPTX_PATH = path.join(__dirname, 'Sean-Walsh-Listing-Presentation.pptx');
const CONTACT_SHEET_PATH = path.join(__dirname, 'deck-contact-sheet.png');
const HTML_FILE = `file://${path.join(__dirname, 'listing-presentation-print.html')}`;

async function captureSlides() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const pngPaths = [];

  for (let i = 0; i < TOTAL_SLIDES; i++) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(HTML_FILE, { waitUntil: 'load' });

    await page.evaluate((idx) => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s, j) => {
        if (j === idx) s.classList.add('active');
        else { s.classList.remove('active'); s.style.display = 'none'; }
      });
    }, i);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const slideHandle = await page.$(`#s${i + 1}`);
    const imgPath = path.join(OUT_DIR, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await slideHandle.screenshot({ path: imgPath, type: 'png' });
    pngPaths.push(imgPath);
    console.log(`  Captured slide ${i + 1}/${TOTAL_SLIDES}`);
    await page.close();
  }

  await browser.close();
  return pngPaths;
}

async function buildPdf(pngPaths) {
  /**
   * Build a PDF where each page is exactly 13.33"×7.5" (LAYOUT_WIDE 16:9)
   * and each page contains one full-bleed image.
   */
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // Build an HTML page with all 10 slides inline as <img>
  const imgTags = pngPaths.map(p => {
    const data = fs.readFileSync(p).toString('base64');
    return `<div class="page"><img src="data:image/png;base64,${data}"/></div>`;
  }).join('');

  const wrapperHtml = `<!DOCTYPE html>
<html><head><style>
  @page { size: 13.33in 7.5in; margin: 0; }
  html, body { margin: 0; padding: 0; background: #000; }
  .page { width: 13.33in; height: 7.5in; page-break-after: always; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  .page img { width: 100%; height: 100%; display: block; object-fit: cover; }
</style></head><body>${imgTags}</body></html>`;

  await page.setContent(wrapperHtml, { waitUntil: 'load' });
  await page.pdf({
    path: PDF_PATH,
    width: '13.33in',
    height: '7.5in',
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log(`  PDF saved → ${PDF_PATH}`);
}

async function buildPptx(pngPaths) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = 'Sean Walsh | Listing Presentation';
  pptx.author = 'Sean Walsh, Cush Real Estate By Design';

  for (const imgPath of pngPaths) {
    const slide = pptx.addSlide();
    slide.addImage({ path: imgPath, x: 0, y: 0, w: '100%', h: '100%' });
  }

  await pptx.writeFile({ fileName: PPTX_PATH });
  console.log(`  PPTX saved → ${PPTX_PATH}`);
}

async function buildContactSheet(pngPaths) {
  /**
   * 5 cols × 2 rows grid. Each slide is captioned with its slide # and title.
   * Lets the user verify all 10 slides at a glance.
   */
  const titles = [
    '1. Title — Maximizing Your Home\'s Value',
    '2. Meet Sean — Expertise Meets Execution',
    '3. Market Reality — Move-In-Ready Premium',
    '4. ROI — Design That Delivers a Return',
    '5. Concierge — Zero Upfront Costs Guaranteed',
    '6. Timeline — 21-Day Sprint to Market',
    '7. Track Record — A Track Record of Success',
    '8. Press — Recognized by Design Authorities',
    '9. Reviews — What Our Sellers Say',
    '10. Closing — Ready to Maximize Your Value?',
  ];

  const cellW = 480, cellH = 270, capH = 50, gap = 16;
  const cols = 5, rows = 2;
  const totalW = gap + (cellW + gap) * cols;
  const totalH = gap + (cellH + capH + gap) * rows;

  const imgEls = pngPaths.map((p, i) => {
    const data = fs.readFileSync(p).toString('base64');
    return `<div class="cell">
      <img src="data:image/png;base64,${data}"/>
      <div class="cap">${titles[i]}</div>
    </div>`;
  }).join('');

  const sheetHtml = `<!DOCTYPE html>
<html><head><style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap');
  html, body { margin: 0; padding: 0; background: #14110c; font-family: 'Inter', sans-serif; color: #fff; width: ${totalW}px; height: ${totalH}px; }
  .grid { display: grid; grid-template-columns: repeat(${cols}, ${cellW}px); gap: ${gap}px; padding: ${gap}px; }
  .cell { width: ${cellW}px; }
  .cell img { width: ${cellW}px; height: ${cellH}px; object-fit: cover; border: 1px solid #C9A84C; }
  .cap { font-size: 14px; color: #E8C96A; padding: 10px 4px 0; line-height: 1.4; font-weight: 500; }
</style></head><body><div class="grid">${imgEls}</div></body></html>`;

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: totalW, height: totalH });
  await page.setContent(sheetHtml, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: CONTACT_SHEET_PATH, type: 'png', fullPage: true });
  await browser.close();
  console.log(`  Contact sheet → ${CONTACT_SHEET_PATH}`);
}

(async () => {
  console.log('\n[1/4] Capturing 10 slide PNGs at 1920×1080...');
  const pngPaths = await captureSlides();

  console.log('\n[2/4] Building PDF...');
  await buildPdf(pngPaths);

  console.log('\n[3/4] Building PPTX...');
  await buildPptx(pngPaths);

  console.log('\n[4/4] Building contact sheet for verification...');
  await buildContactSheet(pngPaths);

  console.log('\n✓ All artifacts generated.\n');
})();
