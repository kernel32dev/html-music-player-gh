#!/bin/bash
echo genlib.sh
echo 'library={"prefix":"lib/","thumbnail_ext":["jpg","png"],"track_ext":["mp3","ogg"],"lyrics_ext":["lyrics"],"movie_ext":["mp4","ogv","mkv","webm"],"lib":[' > library.js.wip
find lib -xtype f -name '*.*' ! -name '*.txt' -or -name 'skip' | sed 's|....||' | awk '{print "\"" $0 "\","}' >> library.js.wip
echo ']}' >> library.js.wip
mv library.js.wip library.js
echo genlib.sh - completed
