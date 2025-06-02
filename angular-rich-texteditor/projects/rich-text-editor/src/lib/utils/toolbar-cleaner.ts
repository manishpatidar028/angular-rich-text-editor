export function cleanToolbarString(toolbar: string): string {
  let cleaned = toolbar;

  // Remove :toggle and :dropdown
  cleaned = cleaned.replace(/:toggle/g, '').replace(/:dropdown/g, '');

  // Fix spacing and redundancy
  cleaned = cleaned
    .replace(/,+/g, ',')
    .replace(/\{,+/g, '{')
    .replace(/,+\}/g, '}')
    .replace(/\|+/g, '|')
    .replace(/\{\s*\|/g, '{')
    .replace(/\|\s*\}/g, '}')
    .replace(/\{\s*\}/g, '')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*\|\s*/g, '|')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}');

  // Fix tool concatenation issues
  cleaned = cleaned.replace(/\b([a-z]),(?=[a-z],|[a-z]\b)/g, '$1');

  let previousCleaned = '';
  while (previousCleaned !== cleaned) {
    previousCleaned = cleaned;
    cleaned = cleaned.replace(/\b([a-z]),(?=[a-z],|[a-z]\b)/g, '$1');
  }

  // Process sections
  const sections = cleaned.split(/([/#])/);
  const processedSections: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    if (section === '/' || section === '#') {
      processedSections.push(section);
      continue;
    }

    if (!section.trim()) continue;

    const groups = section.split('|');
    const processedGroups: string[] = [];

    for (let group of groups) {
      const hasBraces = group.includes('{') || group.includes('}');
      let content = group.replace(/[{}]/g, '').trim();

      if (!content) continue;

      // Fix common concatenation issues
      content = content
        .replace(/(?<=fontname)(?=fontsize)/g, ',')
        .replace(/(?<=fontsize)(?=inlinestyle)/g, ',')
        .replace(/(?<=inlinestyle)(?=lineheight)/g, ',')
        .replace(/(?<=paragraphs)(?=fontname)/g, ',')
        .replace(/(?<=paragraphstyle)(?=menu_)/g, ',')
        .replace(/underlinefore/g, 'underline,fore')
        .replace(/forecolorback/g, 'forecolor,back')
        .replace(/backcolor/g, 'backcolor')
        .replace(/outdentsuperscript/g, 'outdent,superscript')
        .replace(/insertlinkun/g, 'insertlink,un')
        .replace(/unlinkinsert/g, 'unlink,insert')
        .replace(/insertblockquote/g, 'insertblockquote')
        .replace(/inserttable/g, 'inserttable')
        .replace(/insertimage/g, 'insertimage')
        .replace(/removeformat/g, 'removeformat');

      content = content.replace(/,+/g, ',').trim();

      if (content) {
        processedGroups.push(hasBraces ? `{${content}}` : content);
      }
    }

    if (processedGroups.length > 0) {
      processedSections.push(processedGroups.join('|'));
    }
  }

  cleaned = processedSections.join('');

  // Final cleanup
  cleaned = cleaned
    .replace(/\{\s*\}/g, '')
    .replace(/\|+/g, '|')
    .replace(/\/+/g, '/')
    .replace(/#+/g, '#')
    .replace(/^[|/#]+|[|/#]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}
