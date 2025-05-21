import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { RichTextEditorModule } from 'rich-text-editor';

export const RTE_TOOLBAR_PRESETS = {
  BASIC: 'bold,italic,underline|fontname,fontsize|forecolor,backcolor|removeformat',
  STANDARD: 'bold,italic,underline,strikethrough|fontname,fontsize|forecolor,backcolor|removeformat|undo,redo',
  FULL: "{bold,italic,underline,forecolor,backcolor}|{justifyleft,justifycenter,justifyright,justifyfull}|{insertorderedlist,insertunorderedlist,indent,outdent}{superscript,subscript}"
	+ " #{paragraphs:toggle,fontname:toggle,fontsize:toggle,inlinestyle,lineheight}"
	+ " / {removeformat,cut,copy,paste,delete,find}|{insertlink,unlink,insertblockquote,insertemoji,insertchars,inserttable,insertimage,insertgallery,insertvideo,insertdocument,insertcode}"
	+ "#{preview,code,selectall}"
	+ " /{paragraphs:dropdown | fontname:dropdown | fontsize:dropdown} {paragraphstyle,toggle_paragraphop,menu_paragraphop}"
	+ "#{toggleborder,fullscreenenter,fullscreenexit,undo,redo,togglemore}",
  MINIMAL: 'bold,italic|fontsize|forecolor|removeformat',
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FormsModule, RichTextEditorModule],
  providers: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  toolbarGroup = RTE_TOOLBAR_PRESETS;
  title = 'sample-app';
    content = '<p>Initial content goes here</p>';
}
