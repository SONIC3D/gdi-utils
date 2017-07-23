# GDI-Utils
A converter for converting GDI image in redump.org format to General GDI image format.

## Changelog
* 2017.Jul.23: Finished general gdi image format writer.

## Introduction
This converter convert Sega Dreamcast GDI image released in redump.org format to General GDI format.

## Technical Detail
### Terminology
* General GDI format represents gdi imaged dumped with httpd-ack.
* Redump.org GDI represent GDI image set dumped and released by redump.org.

### Detail
Redump.org GDI and General GDI shares with the same file extention name ".gdi". That's a file similiar but simpler than ".cue" file widely used in CD-ROM image to identify track filenames and track location in the whole disc layout.

But redump.org gdi image has several difference compare to the general gdi format.
* Indent white space in ".gdi" file.
* PreGap data are embedded in audio track file.
* The last data track of games with split data track(more than 4 tracks and last data track is after another audio track) contains 75 sectors of data from the tail of its previous audio track and 150 sectors of Pregap. 
* Different track start LBA value caused by the above 2 differences.
  
### Manual conversion guide
* For game with only 3 tracks:

    Remove the heading 150 sectors from track 2 in low density area and plus 150 of its track LBA in ".gdi" file.
    
* For game with more than 3 tracks but the last track is an audio track:

    Remove the heading 150 sectors from all audio track and plus 150 of its track LBA in ".gdi" file.
    
* For game with more than 3 tracks and the last track is a data track:

    * Remove the heading 150 sectors from all audio track and add 150 to its track LBA value in ".gdi" file.
    * Copy the heading 75 sectors from the last data track and append them to the last audio track.
    * Remove the heading 225 sectors from the last data track.
    * Add 225 to the LBA value of last data track in ".gdi" file.
    
### Tools based conversion guide
* Check the Usage section in this ReadMe file. 

## Usage
1. Install Node.js runtime environment(6.x LTS version is enough).
2. Install NPM.
3. Install Typescript compiler in your OS(`npm install -g typescript`).
4. Open terminal and enter this project dir.
5. Run `npm install` to install all required components for compiling.
6. Run `npm run build` to build this project.
7. Run `node bin/bin-nodejs/index.js` to see the help 
8. Run `node bin/bin-nodejs/index.js <your_gdiimage_dir>/input.gdi 0 <output_dir>` to do conversion.

## Testing target
I have tested this tool with games list below.
After the conversion, games can be boot with ODE like GDEmu.
* Fushigi no Dungeon - Furai no Shiren Gaiden - Jokenji Asuka Kenzan! (Japan)
* King of Fighters, The - Dream Match 1999 (Japan) (En,Ja,Es,Pt)
