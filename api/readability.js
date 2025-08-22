const { Readability } = require("@mozilla/readability");
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { encode: htmlEntitiesEscape } = require("html-entities");
const createDOMPurify = require("dompurify");

const { APP_URL, DEFAULT_USER_AGENT_SUFFIX, FALLBACK_USER_AGENT } = require("./_common.js");

module.exports = async (request, response) => {
  if ((request.headers["user-agent"] ?? "").includes("readability-bot")) {
    response.send(EASTER_EGG_PAGE);
    return;
  }
  let { url, type, format, changeiframe } = request.query;
  changeiframe = changeiframe === 'true' || changeiframe === '1';
  if (!format) {
    format = type; // the type param will be deprecated in favor of format
  }
  if (!url & (format !== "json")) {
    response.redirect(APP_URL);
    return;
  }
  let meta, upstreamResponse;
  try {
    if (!isValidUrl(url)) {
      response.status(400).send("Invalid URL");
      return;
    }
    const headers = constructUpstreamRequestHeaders(request.headers);
    console.debug("RH: ", headers);
    upstreamResponse = await fetch(url, {
      headers,
    });
    console.debug("UP: ", upstreamResponse);
    const dom = new JSDOM(await upstreamResponse.textConverted(), { url: url });
    const DOMPurify = createDOMPurify(dom.window);
    const doc = dom.window.document;
    fixImgLazyLoadFromDataSrc(doc);
    const hostname = (new URL(url)).hostname
    if (hostname === "www.xiaohongshu.com") {
      fixXiaohongshuImages(doc);
    }
    if (hostname === "mp.weixin.qq.com") {
      fixWeixinArticle(doc);
    }

    if (changeiframe) {
      doc.querySelectorAll('iframe').forEach(iframe => {
        let src = iframe.getAttribute('src');
        let textContent = src;

        if (src.startsWith('//')) {
          src = 'https:' + src;
        }

        if (src.startsWith('https://vkvideo.ru/video_ext.php?') || src.startsWith('https://vk.com/video_ext.php?')) {
          const urlParams = new URLSearchParams(src.split('?')[1]);
          const oid = urlParams.get('oid');
          const id = urlParams.get('id');
          if (oid && id) {
            src = `https://vkvideo.ru/video${oid}_${id}`;
          }
          textContent = 'vk video';
        }
        else if (src.startsWith('https://vk.com/widget_playlist.php?')) {
          const urlParams = new URLSearchParams(src.split('?')[1]);
          const oid = urlParams.get('oid');
          const pid = urlParams.get('pid');
          if (oid && pid) {
            src = `https://vk.com/music/album/${oid}_${pid}`;
          }
          textContent = 'vk album';
        }
        else if (src.startsWith('https://music.yandex.ru/iframe/album/')) {
          const albumId = src.split('/').pop();
          src = `https://music.yandex.ru/album/${albumId}`;
          textContent = 'yandex music';
        }
        else if (src.startsWith('https://www.youtube.com/embed/')) {
          const videoId = src.split('/').pop();
          src = `https://www.youtube.com/watch?v=${videoId}`;
          textContent = 'youtube';
        }
        else if (src.startsWith('https://music.mts.ru/widget/album/')) {
          const albumId = src.split('/')[5].split('?')[0];
          src = `https://music.mts.ru/album/${albumId}`;
          textContent = 'mts music';
        }

        const link = doc.createElement('a');
        link.href = src;
        link.textContent = textContent;
        link.target = '_blank';

        iframe.parentNode.replaceChild(link, iframe);
      });
    }
    let articleContent = null;
    if (hostname === "telegra.ph") {
      const ac = doc.querySelector(".tl_article_content");
      if (ac) {
        // CSS rules in https://telegra.ph/css/core.min.css
        ac.querySelector("h1").style.display = "none";
        ac.querySelector("address").style.display = "none";

        articleContent = ac.innerHTML;
      }
    }
    let datePublished = null;
    let author = null;
    let tags = [];
    let constLang = null;
    //let debug = {}; // TODO
    let pageNotFound = false;
    if (hostname === "www.rap.ru") {
      const newValue = fixRapRuArticle(doc);
      datePublished = newValue.datePublished;
      author = newValue.author;
      tags = newValue.tags;
      pageNotFound = newValue.notFound;
    }
    if (hostname === "the-flow.ru") {
      const newValue = fixTheFlowArticle(doc);
      datePublished = newValue.datePublished;
      author = newValue.author;
      pageNotFound = newValue.notFound;
    }
    if (hostname === "hiphop4real.com") {
      const newValue = fixHiphop4realArticle(doc);
      tags = newValue.tags;
      pageNotFound = newValue.notFound;
    }
    if (pageNotFound) {
      articleContent = 'Cтраница не найдена!';
    }
    if (hostname === "thecode.media") {
      const newValue = fixThecodeMediaArticle(doc);
      tags = newValue.tags;
    }
    if (hostname === 'www.volzsky.ru') {
      const newValue = fixVolzskyArticle(doc);
      datePublished = newValue.datePublished;
      author = newValue.author;
      constLang = 'ru-RU';
    }

    const reader = new Readability(doc);
    const article = reader.parse();
    const lang = constLang ?? extractLang(doc);
    // some stupid websites like xiaohongshu.com use the non-standard "name" attr
    const ogImage = doc.querySelector('meta[property="og:image"], meta[name="og:image"]');
    meta = Object.assign({ url, lang }, article);
    meta.lang = lang ?? meta.lang;
    meta.byline = stripRepeatedWhitespace(author ?? meta.byline);
    meta.siteName = stripRepeatedWhitespace(meta.siteName);
    meta.excerpt = stripRepeatedWhitespace(meta.excerpt);
    meta.content = DOMPurify.sanitize(articleContent ?? meta.content);
    meta.imageUrl = (ogImage || {}).content;
    meta.publishedTime = datePublished ?? meta.publishedTime;
    meta.tags = tags;
    //meta.debug = debug; // TODO
  } catch (e) {
    console.error(e);
    response.status(500).send(e.toString());
    return;
  }
  response.setHeader('cache-control', upstreamResponse.headers["cache-control"] ?? "public, max-age=900");
  if (format === "json") {
    console.debug(meta);
    response.json(meta);
  } else {
    response.send(render(meta));
  }
};

function render(meta) {
  let { lang, title, byline: author, siteName, content, url, excerpt, imageUrl } = meta;
  const genDate = new Date();
  const langAttr = lang ? `lang="${lang}"` : "";
  const byline =
    [author, siteName].filter((v) => v).join(" • ") || new URL(url).hostname;
  siteName = siteName || new URL(url).hostname;
  const ogSiteName = siteName
    ? `<meta property="og:site_name" content="${htmlEntitiesEscape(siteName)}">`
    : "";
  const ogAuthor = byline
    ? `<meta property="article:author" content="${htmlEntitiesEscape(byline)}">`
    : "";
  const ogImage = imageUrl ? `<meta property="og:image" content="${htmlEntitiesEscape(imageUrl)}"/>`
    : "";

  return `<!DOCTYPE html>
<html ${langAttr}>

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="same-origin">
  <meta http-equiv="Content-Security-Policy" content="script-src 'none';">
  <meta http-equiv="Content-Security-Policy" content="frame-src 'none';">
  <meta name="description" content="${htmlEntitiesEscape(excerpt)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${htmlEntitiesEscape(title)}">
  ${ogSiteName}
  <meta property="og:description" content="${htmlEntitiesEscape(excerpt)}">
  ${ogAuthor}
  ${ogImage}
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.3/css/bulma.min.css">
  <title>${htmlEntitiesEscape(title)}</title>
  <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-title" content="Readability" />
  <link rel="manifest" href="/site.webmanifest" />
  <style>
    * {
      font-family: serif;
    }

    p {
      line-height: 1.5;
    }

    p {
      margin-top: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .byline {
      padding-top: 0.5rem;
      font-style: normal;
    }

    .byline a {
      text-decoration: none;
      color: #79828B;
    }

    .byline .seperator {
      /* content: "\\2022"; */
      padding: 0 5px;
    }

    .article-header {
      padding-bottom: 1.5rem;
    }

    .article-body {
      padding-top: 0rem;
      padding-bottom: 0rem;
    }

    .page-footer {
      padding-top: 0rem;excerpt
      padding-bottom: 1.0rem;
    }

    hr {
      marginLeft: 1rem;
      marginRight: 1rem;
    }
  </style>
</head>

<body>
  <main class="container is-max-desktop">
    <header class="section article-header">
      <h1 class="title">
        ${htmlEntitiesEscape(title)}
      </h1>
      <address class="subtitle byline" >
        <a rel="author" href="${url}" target="_blank">
        ${htmlEntitiesEscape(byline)}
        </a>
      </address>
    </header>
    <article class="section article-body is-size-5 content">
      ${content}
    </article>

    <hr />
    <footer class="section page-footer is-size-7">
      <small>The article is scraped and extracted from <a title="Source link" href="${url}" target="_blank">${htmlEntitiesEscape(
    siteName
  )}</a> by <a href="${APP_URL}">readability-bot</a> at <time datetime="${genDate.toISOString()}">${genDate.toString()}</time>.</small>
    </footer>
  </main>
</body>

</html>
`;
}

function constructUpstreamRequestHeaders(headers) {
  let ua = headers["user-agent"];
  if (ua && ua.indexOf("node-fetch") === -1) {
    ua += " " + DEFAULT_USER_AGENT_SUFFIX;
  }
  else {
    ua = FALLBACK_USER_AGENT;
  }
  return {
    "user-agent": ua,
    "referer": "https://www.google.com/?feeling-lucky"
  };
}

function stripRepeatedWhitespace(s) {
  if (s) {
    return s.replace(/\s+/g, " ");
  } else {
    return s;
  }
}

function isValidUrl(url) {
  try {
    const _ = new URL(url);
    return true;
  } catch (_e) {
    return false;
  }
}

const EASTER_EGG_PAGE = `<html>
<head><title>Catastrophic Server Error</title></head>
<body>
  <p>Server is down.</p>
</body>
</html>`;

function extractLang(doc) {
  // Some malformed HTMLs may confuse querySelector.
  return (
    (doc.querySelector("html") &&
      doc.querySelector("html").getAttribute("lang")) ??
    (doc.querySelector("body") &&
      doc.querySelector("body").getAttribute("lang"))
  );
}

function fixImgLazyLoadFromDataSrc(doc) {
  // sample page: https://mp.weixin.qq.com/s/U07oNCwtiAMGnBvYZXPuMg
  console.debug(doc.querySelectorAll("body img:not([src])[data-src]"));
  for (const img of doc.querySelectorAll("body img:not([src])[data-src]")) {
    img.src = img.dataset.src;
  }
}

function fixXiaohongshuImages(doc) {
  // sample page:
  // https://www.xiaohongshu.com/explore/66a589ef000000002701c69e
  const target = doc.querySelector("#detail-desc") ?? doc.querySelector("body");
  // some magic to make readability.js and telegra.ph happy together
  const container = doc.createElement("span");
  target.prepend(container);
  for (const ogImage of doc.querySelectorAll('meta[property="og:image"], meta[name="og:image"]')) {
    const url = ogImage.content;
    // console.log("xhsImg", url);
    const imgP = doc.createElement("p");
    const img = doc.createElement("img");
    img.src = url;
    imgP.append(img);
    container.append(imgP);
  }
}

function fixWeixinArticle(doc) {
  // sample page: https://mp.weixin.qq.com/s/ayHC7MpG6Jpiogzp-opQFw
  const jc = doc.querySelector("#js_content, .rich_media_content");
  if (jc) {
    jc.style = ""; // remove visibility: hidden
  }
}

function fixRapRuArticle(doc) {
  const result = {
    datePublished: null,
    author: null,
    tags: [],
    notFound: false
  }

  //---notFound---
  const headElement = doc.querySelector('h1, h2');
  if (headElement && headElement?.textContent.toLowerCase().includes('данной страницы не существует')) {
    result.notFound = true;
    return result;
  }

  //---datePublished---
  const dateElements = doc.querySelectorAll("p.date, span.date");
  let dateString = '';
  for (const el of dateElements) {
    dateString = el.textContent.trim() || dateString;
    el.remove();
  }
  if (!!dateString) {
    const months = {
      января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5,
      июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11
    };
    const parts = dateString.split(/[\s,]+/);
    const day = parseInt(parts[0], 10);
    const month = months[parts[1].toLowerCase().trim()];
    const year = parseInt(parts[2], 10);
    const timeParts = parts[3].split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    result.datePublished = new Date(year, month, day, hours, minutes);
  }

  //---author---
  const authorElements = doc.querySelectorAll("p.authors, span.authors, p.author, span.author");
  let authorString = '';
  for (const el of authorElements) {
    authorString = el.textContent.trim() || authorString;
    el.remove();
  }
  if (!!authorString) {
    result.author = authorString.replaceAll('Авторы:', '').replaceAll('Автор:', '').trim();
  }

  //---og:image og:sitename---
  const img = doc.querySelector('img.pic');
  if (img?.src) {
    const meta = doc.createElement('meta');
    meta.setAttribute('property', 'og:image');
    meta.setAttribute('content', img.src);
    doc.head.appendChild(meta);
  }
  meta = doc.createElement('meta');
  meta.setAttribute('property', 'og:site_name');
  meta.setAttribute('content', 'RAP.RU');
  doc.head.appendChild(meta);

  //---quote---
  doc.querySelectorAll('div.announce').forEach(div => {
    if (div.textContent.trim() !== '') {
      const blockquote = doc.createElement('blockquote');
      blockquote.innerHTML = div.innerHTML;
      Array.from(div.attributes).forEach(attr => {
        blockquote.setAttribute(attr.name, attr.value);
      });
      div.replaceWith(blockquote);
    } else {
      div.remove();
    }
  });

  //---tags---
  result.tags = Array.from(doc.querySelectorAll('div.tags a')).map(a => a.textContent.trim());

  //---лишнее, копия из instantview template---
  doc.querySelectorAll('hr + p a').forEach(el => el.remove());
  doc.querySelectorAll('hr ~ p strong').forEach(el => {
    if (el.textContent.toLowerCase().includes('в тему')) {
      el.remove();
    }
  });
  doc.querySelectorAll('hr').forEach(el => el.remove());

  return result;
}

function fixTheFlowArticle(doc) {
  const result = {
    datePublished: null,
    author: null,
    notFound: false
  }

  //---notFound---
  const headElement = doc.querySelector('h1, h2');
  if (headElement && headElement?.textContent.toLowerCase().includes('данная страница не найдена')) {
    result.notFound = true;
    return result;
  }

  //---datePublished---
  const dateElements = doc.querySelectorAll("meta[itemprop='datePublished']");
  let dateString = '';
  for (const el of dateElements) {
    dateString = el?.content.trim() || dateString;
    el.remove();
  }
  if (dateString) {
    const date = new Date(dateString);
    const now = new Date(); //есть только дата, поэтому добавляем текущее время
    date.setHours(now.getHours());
    date.setMinutes(now.getMinutes());
    date.setSeconds(now.getSeconds());
    result.datePublished = date.toISOString();
  }

  //---author---
  //result.author = 'The Flow'; //автора нет, поэтому константа

  //---quote & content---
  const descr = doc.querySelector('div.article__descr');
  const text = doc.querySelector('div.article__text');
  const body = doc.querySelector('body');
  if (descr && text) {
    text.innerHTML = descr.outerHTML + text.innerHTML;
    descr.remove();
  }
  if (body && text) {
    body.innerHTML = text.innerHTML;
  }
  doc.querySelectorAll('div.article__descr').forEach(div => {
    if (div.textContent.trim() !== '') {
      const blockquote = doc.createElement('blockquote');
      blockquote.innerHTML = div.innerHTML;
      Array.from(div.attributes).forEach(attr => {
        blockquote.setAttribute(attr.name, attr.value);
      });
      div.replaceWith(blockquote);
    } else {
      div.remove();
    }
  });

  //---удаление 'в тему:'---
  const hrs = doc.querySelectorAll('hr');
  // Проходим по парам <hr> (0-1, 2-3, 4-5 и т.д.)
  for (let i = 0; i < hrs.length; i += 2) {
    const firstHr = hrs[i];
    const secondHr = hrs[i + 1];
    if (!secondHr) break; // Если нет пары, выходим
    // Проверяем, есть ли между ними "в тему:"
    let node = firstHr.nextSibling;
    let hasInTheme = false;
    // Перебираем узлы между <hr>
    while (node && node !== secondHr) {
      if (node.textContent.toLowerCase().includes('в тему:')) {
        hasInTheme = true;
        break;
      }
      node = node.nextSibling;
    }
    // Если нашли "в тему:", удаляем пару <hr> и всё между ними
    if (hasInTheme) {
      const nodesToRemove = [];
      let currentNode = firstHr.nextSibling;
      // Собираем узлы между <hr> для удаления
      while (currentNode && currentNode !== secondHr) {
        nodesToRemove.push(currentNode);
        currentNode = currentNode.nextSibling;
      }
      // Удаляем всё между <hr>
      nodesToRemove.forEach(node => node.remove());
      // Удаляем сами <hr>
      firstHr.remove();
      secondHr.remove();
      // Уменьшаем индекс, т.к. массив hrs изменился
      i -= 2;
    }
  }

  return result;
}

function fixHiphop4realArticle(doc) {
  const result = {
    tags: [],
    notFound: false
  }

  //---notFound---
  const headElement = doc.querySelector('h1, h2');
  if (headElement && headElement?.textContent.toLowerCase().includes('данная страница не найдена')) {
    result.notFound = true;
    return result;
  }

  //---title---
  const metaTag = doc.querySelector('meta[property="og:title"]');
  if (metaTag) {
    metaTag.setAttribute('content', metaTag.getAttribute('content').replace('— HipHop4Real', '').trim());
  }

  //---tags---
  result.tags = Array.from(doc.querySelectorAll('div.entry_tags a')).map(a => a.textContent.trim());

  //---content---
  const text = doc.querySelector('div.entry_content');
  const body = doc.querySelector('body');
  if (body && text) {
    body.innerHTML = text.innerHTML;
  }
  doc.querySelectorAll('div.full_meta').forEach(div => {
    div.remove();
  });

  return result;
}

function fixThecodeMediaArticle(doc) {
  const result = {
    tags: []
  }

  //---title---
  const metaTag = doc.querySelector('meta[property="og:title"]');
  if (metaTag) {
    metaTag.setAttribute('content',
      metaTag.getAttribute('content')
        .replace(/\s*—\s*(журнал\s*)?[«"]?код[»"]?.*$/gi, '')
        .trim())
  }

  //---tags---
  result.tags = [...new Set(
    Array.from(doc.querySelectorAll('a.crumb-name'))
      .map(a => a.textContent.trim().replace(/^#/, ''))
  )];

  return result;
}

function fixVolzskyArticle(doc) {
  const result = {
    datePublished: null,
    author: null
  }

  //---content---
  const text = doc.querySelector('div#n_n');
  const body = doc.querySelector('body');
  if (body && text) {
    body.innerHTML = text.innerHTML;
  }

  //---datePublished---
  const allDivs = doc.querySelectorAll('div');
  let lastDiv = null;
  for (const div of allDivs) {
    const text = div.textContent.trim();
    const match = text.match(/\d{2} \S+ \d{4} \d{2}:\d{2}:\d{2}/);
    if (match) {
      const dateString = match[0]; // "05 июня 2025 15:58:10"
      const months = {
        января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5,
        июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11
      };
      const dateParts = dateString.split(' ');
      const day = parseInt(dateParts[0], 10);
      const month = months[dateParts[1]];
      const year = parseInt(dateParts[2], 10);
      const [hours, minutes, seconds] = dateParts[3].split(':').map(Number);
      result.datePublished = new Date(year, month, day, hours, minutes, seconds);
      lastDiv = div;
    }
  }
  if (lastDiv) {
    lastDiv.remove();
  }

  //---author---
  const authorElements = doc.querySelectorAll('a[itemprop="author"]');
  let authorString = '';
  for (const el of authorElements) {
    authorString = el.textContent.trim() || authorString;
  }
  if (authorString) {
    result.author = authorString;
  }

  return result;
}