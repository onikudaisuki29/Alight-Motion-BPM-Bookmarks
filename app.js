const $ = (id) => document.getElementById(id);
const fileInput = $('input-file');
let sourceXml = null;
let syncing = false;

function number(id) {
  const value = Number($(id).value);
  if (!Number.isFinite(value)) throw new Error(`「${$(id).closest('label')?.childNodes[0]?.textContent?.trim() || id}」を正しく入力してください。`);
  return value;
}
function setStatus(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function syncSeconds() {
  if (syncing) return;
  const bpm = Number($('bpm').value), beats = Number($('beats').value);
  if (bpm > 0 && beats > 0) { syncing = true; $('seconds').value = (beats * 60 / bpm).toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); syncing = false; }
}
function syncBeats() {
  if (syncing) return;
  const bpm = Number($('bpm').value), seconds = Number($('seconds').value);
  if (bpm > 0 && seconds >= 0) { syncing = true; $('beats').value = String(Math.max(1, Math.round(seconds * bpm / 60))); syncing = false; }
}
['bpm', 'beats'].forEach((id) => $(id).addEventListener('input', syncSeconds));
$('seconds').addEventListener('input', syncBeats);

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  sourceXml = file ? await file.text() : null;
  $('file-name').textContent = file ? file.name : 'ファイルを選択';
  $('new-settings').hidden = Boolean(file);
  $('replace-wrap').hidden = !file;
  if (file) {
    const fps = /<scene\b[^>]*\bfps\s*=\s*["']([^"']+)["']/i.exec(sourceXml)?.[1];
    if (fps) $('fps').value = fps;
    setStatus('既存XMLを読み込みました。');
  }
});

function template() {
  const type = $('project-type').value;
  const title = $('title').value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const width = number('width'), height = number('height'), fps = number('fps');
  if (width <= 0 || height <= 0 || fps <= 0) throw new Error('解像度とFPSは0より大きい値にしてください。');
  const attrs = type === '要素' ? 'bgcolor="#00000000" type="element"' : 'bgcolor="#FF000000"';
  return `<?xml version='1.0' encoding='UTF-8' ?>\n<scene title="${title}" width="${width}" height="${height}" exportWidth="${width}" exportHeight="${height}" ${attrs} totalTime="0" fps="${fps}" modifiedTime="${Date.now()}" amver="864" ffver="107" am="com.alightcreative.motion/6.2.57" amplatform="ios" precompose="dynamicResolution" retime="freeze">\n</scene>\n`;
}
function addBookmarks(xml) {
  const bpm = number('bpm'), start = number('start-ms'), beats = number('beats'), split = number('subdivision');
  if (bpm <= 0 || start < 0 || beats < 1 || split < 1 || !Number.isInteger(beats) || !Number.isInteger(split)) throw new Error('BPM、開始位置、拍数、分割数を正しく入力してください。');
  const scene = /<scene\b[^>]*>/i.exec(xml);
  if (!scene) throw new Error('<scene> タグが見つかりません。Alight Motion XMLを選んでください。');
  const fps = Number(/\bfps\s*=\s*["']([^"']+)["']/.exec(scene[0])?.[1]);
  const snap = $('snap').checked;
  if (snap && !(fps > 0)) throw new Error('フレームに合わせるには、有効なFPSが必要です。');
  if (sourceXml && $('replace').checked) xml = xml.replace(/^[ \t]*<bookmark\b[^>]*\/>[ \t]*(?:\r?\n)?/gm, '');
  const cleanScene = /<scene\b[^>]*>/i.exec(xml);
  const newline = xml.includes('\r\n') ? '\r\n' : '\n';
  const after = xml.slice(cleanScene.index + cleanScene[0].length);
  const indent = /^\r?\n([ \t]+)</.exec(after)?.[1] || '  ';
  const interval = 60000 / bpm / split;
  let bookmarks = '';
  for (let i = 0; i < beats * split; i += 1) {
    let time = start + i * interval;
    if (snap) time = Math.round(time * fps / 1000) * 1000 / fps;
    bookmarks += `${newline}${indent}<bookmark t="${Math.round(time)}"/>`;
  }
  return { xml: xml.slice(0, cleanScene.index + cleanScene[0].length) + bookmarks + xml.slice(cleanScene.index + cleanScene[0].length), count: beats * split };
}
$('generate').addEventListener('click', () => {
  try {
    const result = addBookmarks(sourceXml || template());
    const filename = sourceXml ? fileInput.files[0].name.replace(/\.xml$/i, '_bookmarks.xml') : `${$('title').value.trim() || 'BPM_Bookmarks'}.xml`;
    const url = URL.createObjectURL(new Blob([result.xml], { type: 'application/xml;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    link.click(); URL.revokeObjectURL(url);
    setStatus(`${result.count}個のブックマークを生成しました。`);
  } catch (error) { setStatus(error.message, true); }
});
