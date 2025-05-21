export type RTEPreset = 'BASIC' | 'STANDARD' | 'FULL' | 'MINIMAL';

export const RTE_TOOLBAR_PRESETS: Record<RTEPreset, string> = {
  BASIC: 'bold,italic,underline|fontname,fontsize|forecolor,backcolor|removeformat',
  STANDARD: 'bold,italic,underline,strikethrough|fontname,fontsize|forecolor,backcolor|removeformat|undo,redo',
  FULL: "{bold,italic,underline,forecolor,backcolor}|{justifyleft,justifycenter,justifyright,justifyfull}|{insertorderedlist,insertunorderedlist,indent,outdent}{superscript,subscript}" +
    " #{paragraphs:toggle,fontname:toggle,fontsize:toggle,inlinestyle,lineheight}" +
    " / {removeformat,cut,copy,paste,delete,find}|{insertlink,unlink,insertblockquote,insertemoji,insertchars,inserttable,insertimage,insertgallery,insertvideo,insertdocument,insertcode}" +
    "#{preview,code,selectall}" +
    " /{paragraphs:dropdown | fontname:dropdown | fontsize:dropdown} {paragraphstyle,toggle_paragraphop,menu_paragraphop}" +
    "#{toggleborder,fullscreenenter,fullscreenexit,undo,redo,togglemore}",
  MINIMAL: 'bold,italic|fontsize|forecolor|removeformat'
};

export type RTEImageTool =
  | 'menu_controlsize'
  | 'imagecaption'
  | 'controlalt'
  | 'controlinsertlink'
  | 'controleditlink'
  | 'controlopenlink'
  | 'controlunlink'
  | 'menu_controljustify'
  | 'imagestyle'
  | 'delete';