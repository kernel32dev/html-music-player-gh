// GLOBALS
let library = {
    lib:[""],
    thumbnail_ext:[""],
    track_ext:[""],
    lyrics_ext:[""],
    movie_ext:[""],
    prefix:""
};

if (false) var audio = new Audio();
audio = null;
let deleteaudio = null;
let loadtrack = null;
let drag = null;
let playlistLock = false;
let all = document.body; all = null;
let gl = null;
let lyricsdb = {};
let filedb = {};
let skipdb = {};
let skip = null;
let skips = [];
let skipseq = 0;
let audio_updateTimestamp = null;
const MOBILE = isMobile();
const FOLDER_ONLY_IMMEDIATE = false; // sets if folder or album should be the entire path or just the immediate folder
const BODY_LOADING_TIME = 250;
const SKIP_BUTTON_TIMEOUT = 5000;

let storage = InitializeStorage(true);

function isMobile() {
    // return false; // FORCE DESKTIOP
    // return true;  // FORCE MOBILE
    if (navigator.userAgentData)
        return navigator.userAgentData.mobile;
    const toMatch = [
        /Android/i,
        /webOS/i,
        /iPhone/i,
        /iPad/i,
        /iPod/i,
        /BlackBerry/i,
        /Windows Phone/i,
        /playbook/i,
        /silk/i,
    ];
    return toMatch.some((i) => navigator.userAgent.match(i));
}

function toTimestamp(i) {
    i = Math.round(i);
    let s = (i % 60);
    let m = (i - s) / 60;
    let h = Math.floor(m / 60);
    if (h) {
        m -= h * 60;
    }
    return (h ? h + ((m < 10) ? ':0':':') : '') + ((s < 10)
    ? m + ':0' + s
    : m + ':'  + s);
}

function fromTimestamp(s) {
    let negated = false;
    if (s.startsWith("!")) {
        s = s.substr(1);
        negated = true;
    }
    let a = s.split(":");
    let i = 0;
    if (a.length >= 1) i += Number(a[a.length - 1]);
    if (a.length >= 2) i += Number(a[a.length - 2]) * 60;
    if (a.length >= 3) i += Number(a[a.length - 3]) * 3600;
    if (negated) {
        return -i - 1;
    } else {
        return i;
    }
}

//state classes: on #all
//empty (previously playlist.empty)
//nolocal (has no local video) (previously main.vempty)
//hasvc (vcurrent is not empty) (previously main.hasvc)

function findlib(src) {
    return library.lib.indexOf(src);
}

function removeprefix(src) {
    return src.startsWith(library.prefix) ? src.substr(library.prefix.length) : src;
}

// FUNCTIONS FOR CREATING HTML

function create(tagname) {
    let elem = document.createElement(String(tagname));
    for (let i = 1; i < arguments.length; i++) {
        if (typeof arguments[i] === "string") {
            if (arguments[i].length) elem.classList.add(arguments[i]);
        } else if (typeof arguments[i] === "object") {
            if (arguments[i] !== null) elem.append(arguments[i]);
        } else if (typeof arguments[i] === "function") {
            arguments[i](elem);
        }
    }
    return elem;
}
function setatt(name,value) {
    return function(elem) {elem.setAttribute(name,value);}
}
function settext(text) {
    return function(elem) {elem.innerText = text;}
}

// LOGIC FUNCTIONS

function createFileSystem() {
    let root = document.getElementById("filesystem");
    let lastElemFocus = root.firstElementChild; // aka null
    let self = {addFolder:funcFolder(root,1),addFile:funcFile(root,1)};
    root.addEventListener("scroll", function(ev){
        storage.set("global","fsscroll",root.scrollTop);
    });
    //root.addEventListener('focus',function(){
    //    if (lastElemFocus === null) {
    //        lastElemFocus = root.firstElementChild;
    //        if (lastElemFocus.classList.contains('folder'))
    //            lastElemFocus = lastElemFocus.firstElementChild;
    //    }
    //    setElemFocus(lastElemFocus);
    //});
    function setElemFocus(elem) {
        if (elem === null) return;
        if (lastElemFocus !== null) lastElemFocus.classList.remove('last-focus');
        lastElemFocus = elem;
        lastElemFocus.classList.add('last-focus');
        if (!MOBILE) {
            lastElemFocus.scrollIntoView({"block":"nearest"});
            lastElemFocus.focus();
        }
    }
    function keyboardNavigate(elem,ev,isexpanded) {
        function setf(elem) {
            if (elem === null) return;
            if (elem === root) elem = root.firstElementChild;
            if (elem.classList.contains('folder')) elem = elem.firstElementChild;
            setElemFocus(elem);
        }
        switch (ev.keyCode) {
            case 39: // right
            ev.preventDefault();
            if (isexpanded === false) {
                return true; // if closed, then expand
            } else if (isexpanded === true) {
                // else focus on child
                if (elem.nextElementSibling.firstElementChild)
                    setf(elem.nextElementSibling.firstElementChild);
                return null;
            } else {
                return true; // am not a folder, open perhaps
            }
            case 37: // left
            ev.preventDefault();
            if (isexpanded === true) {
                return false; // if expanded, then close
            } else if (isexpanded === null) {
                setf(elem.parentElement.parentElement); // child->body->folder
            } else {
                setf(elem.parentElement.parentElement.parentElement); // head->folder->body->folder
            }
            return null;
            case 38: // up
            ev.preventDefault();
            if (isexpanded === null) {
                if (elem.previousElementSibling === null) {
                    setf(elem.parentElement.parentElement); // child->body->folder
                } else {
                    setf(elem.previousElementSibling);
                }
            } else {
                elem = elem.parentElement;
                if (elem.previousElementSibling === null) {
                    setf(elem.parentElement.parentElement);
                } else {
                    elem = elem.previousElementSibling;
                    while (true) {
                        if (!elem.classList.contains('folder')) {
                            setf(elem); break;
                        } else if (!elem.lastElementChild.classList.contains('expanded')) {
                            setf(elem); break;
                        } else if (elem.lastElementChild.childElementCount === 0) {
                            setf(elem); break;
                        } else {
                            elem = elem.lastElementChild.lastElementChild;
                        }
                    }
                }
            }
            return null;
            case 40: // down
            ev.preventDefault();
            if (isexpanded === true) {
                if (elem.nextElementSibling.firstElementChild) {
                    setf(elem.nextElementSibling.firstElementChild);
                    return null;
                } else {
                    elem = elem.parentElement;
                }
            } else if (isexpanded === false) {
                elem = elem.parentElement;
            }
            while (true) {
                if (elem.nextElementSibling) { // if is not last child then focus on sibling
                    setf(elem.nextElementSibling);
                    return null;
                }
                elem = elem.parentElement; // else move to parent and repeat
                if (elem === root) return null;
                elem = elem.parentElement;
                if (elem === root) return null;
            }
            default: return null;
        }
    }
    function pushElem(elem,parent,index) {
        if (index === undefined) {
            parent.append(elem);
        } else if (index === 0) {
            parent.prepend(elem);
        } else {
            parent.insertBefore(elem, parent.children[2]);
        }
    }
    function funcFolder(elem,level) {
        return function(name,open,onopen,onpress,index) {
            let icon = create('div','folder-icon');
            let head = create('div','head',
                icon,
                create('div','name',settext(name))
            );
            let body = create('div','body');
            let folder = create('div','folder',head,body);
            body.classList.toggle('expanded', open);
            icon.classList.toggle('filled', open);
            head.style.setProperty('--level',String(level));
            head.setAttribute('tabindex','-1');
            head.addEventListener('keydown', function(ev) {
                // FIXME
                //let ret = keyboardNavigate(head,ev,body.classList.contains('expanded') && (ev.keyCode !== 37 || !body.classList.contains('contracting')));
                let ret = keyboardNavigate(head,ev,body.classList.contains('expanded') && (ev.keyCode === 37 || !body.classList.contains('contracting')));
                //let ret = keyboardNavigate(head,ev,body.classList.contains('expanded') && (true || !body.classList.contains('contracting')));
                if (typeof ret === "boolean") {
                    //body.classList.toggle('expanded', ret);
                    //icon.classList.toggle('filled', ret);
                    if (ret) {
                        icon.classList.add('filled');
                        body.classList.add('expanded');
                        body.classList.remove('contracting');
                    } else {
                        icon.classList.remove('filled');
                        body.classList.add('contracting');
                        timerid = setTimeout(function(){
                            body.classList.remove('contracting','expanded');
                            timerid = 0;
                        }, 1000);
                    }
                    if (typeof onopen === "function") onopen(ret);
                }
            });
            //head.addEventListener('mousedown', function(ev){
            //    ev.stopPropagation();
            //    setElemFocus(head);
            //});
            //head.addEventListener('click', enter);
            //head.addEventListener('dblclick', enter);
            //head.addEventListener('click', function(ev){
            //    ev.stopPropagation();
            //    setElemFocus(head);
            //});
            //if (MOBILE) {
            //    head.addEventListener('touchstart', down);
            //    head.addEventListener('touchend', up);
            //} else {
                
            //}
            if (MOBILE) {
                let pressid = 0;
                function down(ev) {
                    let oldrect = head.getBoundingClientRect();
                    if (pressid) clearTimeout(pressid);
                    pressid = setTimeout(function(){
                        let newrect = head.getBoundingClientRect();
                        pressid = 0;
                        if (typeof onpress === "function" &&
                            oldrect.x === newrect.x &&
                            oldrect.y === newrect.y &&
                            oldrect.width === newrect.width &&
                            oldrect.height === newrect.height)
                        {
                            onpress();
                        }
                    },500);
                    ev.stopPropagation();
                }
                function up(ev) {
                    if (pressid) {
                        clearTimeout(pressid);
                        pressid = 0;
                    }
                }
                head.addEventListener('touchstart', down);
                head.addEventListener('touchend', up);
                head.addEventListener('click', function(ev){
                    if (pressid) {
                        clearTimeout(pressid);
                        pressid = 0;
                    }
                    enter(ev);
                });
            } else {
                let pressid = 0;
                function down(ev) {
                    if (pressid) clearTimeout(pressid);
                    pressid = setTimeout(function(){
                        pressid = 0;
                        if (typeof onpress === "function") onpress();
                    },500);
                    ev.stopPropagation();
                }
                function up(ev) {
                    if (pressid) {
                        clearTimeout(pressid);
                        pressid = 0;
                        enter(ev);
                        return;
                    }
                    ev.stopPropagation();
                }
                head.addEventListener('mousedown', down);
                head.addEventListener('mouseup', up);
            }
            let timerid = 0;
            head.addEventListener('keydown', function(ev) {if (ev.keyCode === 13) enter(ev);});
            function enter(ev) {
                let val = body.classList.contains('expanded') && !body.classList.contains('contracting');
                if (typeof onopen === "function") onopen(!val);
                if (ev) ev.stopPropagation();
                if (timerid) {
                    clearTimeout(timerid);
                    timerid = 0;
                }
                if (!val) {
                    icon.classList.add('filled');
                    body.classList.add('expanded');
                    body.classList.remove('contracting');
                } else {
                    icon.classList.remove('filled');
                    body.classList.add('contracting');
                    timerid = setTimeout(function(){
                        body.classList.remove('contracting','expanded');
                        timerid = 0;
                    }, 1000);
                }
            }
            pushElem(folder,elem,index);
            return {
                addFolder: funcFolder(body,level + 1),
                addFile: funcFile(body,level + 1),
                remove: funcRemove(folder),
                parent: self
            };
        }
    }
    function funcFile(elem,level) {
        return function(name,onopen,onpress,isvideo,index) {
            let clearAnimId = 0;
            let icon = create('div','file-icon', isvideo ? 'video' : 'audio',
                !isvideo ? undefined : function(elem) { elem.innerHTML = '<svg height="10" width="10"><polygon points="0,-5 0,5 10,0"></polygon></svg>'; }
            );
            let file = create('div','file', isvideo ? 'progress' : undefined, icon,
                create('div','name',settext(name))
            );
            file.setAttribute('tabindex','-1');
            file.addEventListener('keydown', function(ev) {
                if (ev.keyCode === 13 || keyboardNavigate(file,ev,null))
                    enter(ev);
            });
            file.addEventListener('mousedown', function(ev){
                ev.stopPropagation();
                setElemFocus(file);
            });
            //file.addEventListener('dblclick', enter);
            //file.addEventListener('click', function(ev){
            //    ev.stopPropagation();
            //    setElemFocus(file);
            //});


            if (MOBILE) {
                let pressid = 0;
                function down(ev) {
                    let oldrect = file.getBoundingClientRect();
                    if (pressid) clearTimeout(pressid);
                    pressid = setTimeout(function(){
                        let newrect = file.getBoundingClientRect();
                        pressid = 0;
                        if (typeof onpress === "function" &&
                            oldrect.x === newrect.x &&
                            oldrect.y === newrect.y &&
                            oldrect.width === newrect.width &&
                            oldrect.height === newrect.height)
                        {
                            onpress();
                        }
                    },500);
                    ev.stopPropagation();
                }
                function up(ev) {
                    if (pressid) {
                        clearTimeout(pressid);
                        pressid = 0;
                    }
                }
                file.addEventListener('touchstart', down);
                file.addEventListener('touchend', up);
                file.addEventListener('click', function(ev){
                    if (pressid) {
                        clearTimeout(pressid);
                        pressid = 0;
                    }
                    enter(ev);
                });
            } else {
                let pressid = 0;
                function down(ev) {
                    if (pressid) clearTimeout(pressid);
                    pressid = setTimeout(function(){
                        pressid = 0;
                        if (typeof onpress === "function") onpress();
                    },500);
                    ev.stopPropagation();
                }
                function up(ev) {
                    if (pressid) {
                        clearTimeout(pressid);
                        pressid = 0;
                        enter(ev);
                        return;
                    }
                    ev.stopPropagation();
                }
                file.addEventListener('mousedown', down);
                file.addEventListener('mouseup', up);
            }

            //file.addEventListener('click', enter);
            function enter(ev) {
                let i = !isvideo ? icon : icon.firstElementChild.firstElementChild;
                if (clearAnimId) {
                    clearTimeout(clearAnimId);
                    i.style.animation = "";
                }
                clearAnimId = setTimeout(function(){
                    clearAnimId = 0;
                    i.style.animation = "";
                },1000);
                setTimeout(function(){
                    i.style.animation = isvideo
                    ? "video-icon-push 1s linear"
                    : "audio-icon-push 1s linear";
                },1);
                if (typeof onopen === "function") onopen(ev);
                ev.stopPropagation();
            }
            file.style.setProperty('--level',String(level));
            pushElem(file,elem,index);
            return {
                elem: file,
                setcap: funcSetCap(file,name),
                remove: funcRemove(file),
                parent: self
            };
        }
    }
    function funcRemove(elem) {
        return function() {
            elem.remove();
        }
    }
    function funcSetCap(elem,name) {
        return function(caption) {
            let text = elem.lastElementChild;
            text.innerHTML = name;
            if (caption) {
                let span = document.createElement("span");
                span.innerText = caption;
                span.style.color="#888";
                span.style.marginLeft="10px";
                text.append(span);
            }
        }
    }
    return self;
}

function deduceFolder(src) {
    if (src.startsWith(library.prefix)) {
        src = src.substr(library.prefix.length);
    }
    let a = src.lastIndexOf('/');
    if (a == -1) return "";
    let b = FOLDER_ONLY_IMMEDIATE ? src.lastIndexOf('/',a - 1) : -1;
    return src.slice(b + 1, a);
}

function deduceMedia(src) {
    function exthumb(v) {
        for (let i = 0; i < library.thumbnail_ext.length; i++)
            if (findlib(v + '.' + library.thumbnail_ext[i]) != -1)
                return v + '.' + library.thumbnail_ext[i];
        return false;
    }
    let s = src.startsWith(library.prefix) ? src.substr(library.prefix.length) : src;
    let a = s.lastIndexOf('/');
    let b = s.lastIndexOf('.');
    let name = s.slice(a + 1, b);
    if (library.movie_ext.indexOf(s.substr(b+1)) != -1) {
        let media = {
            img: null,
            title: name,
            folder: deduceFolder(src),
            src: library.prefix + src,
            type: "video"
        };
        return media;
    }
    let img = exthumb(s.substr(0, b));
    if (name.length > 12 && name.charAt(name.length - 12) === '-') {
        let isytid = true;
        for (let i = name.length - 11; i < name.length; i++) {
            let c = name.charCodeAt(i);
            if (!(
                (c >= 48 && c <= 57) ||
                (c >= 65 && c <= 90) ||
                (c >= 97 && c <= 122) ||
                 c == 95 || c == 45
            )) {
                isytid = false;
                break;
            }
        }
        if (isytid) name = name.substr(0, name.length - 12);
    }
    if (img === false) {
        while (true) {
            if (a === -1) {
                img = exthumb("thumbnail");
                if (img === false) img = null;
                break;
            }
            img = exthumb(s.substr(0, a + 1) + "thumbnail");
            if (img !== false) break;
            a = s.lastIndexOf('/', a - 1);
        }
    }
    let media = {
        img: library.prefix + img,
        title: name,
        folder: deduceFolder(src),
        src: library.prefix + src,
        type: "audio"
    };
    return media;
}

let repopulatePlaylists = null;

function populatePlaylists(fs) {
    let i = 1;
    let pls = [];
    let removers = [];
    while (true) {
		let id = "" + i++;
        let v = storage.get("pl", id, undefined);
        if (v === undefined) break;
        pls.push({v:v,id:id});
    }
    let plname = document.getElementById("plname");
    pls.sort(function(a,b){
		if (a < b) return -1;
		if (a > b) return 1;
		return 0;
	});
    for (i = 0; i < pls.length; i++) {
        let id = pls[i].id;
        let arr = pls[i].v.split(':');
        removers.push(fs.addFile(arr[0], function() {
            delete plname.dataset.name;
            delete plname.dataset.id;
            playlistSetLock(true);
            playlistLock = false;
            playlistPlayNone();
            playlistClearPlaylist();
            if (arr.length === 1) return;
            playlistPlayMedia(deduceMedia(arr[1]));
            playlistPlayCard(document.getElementById("vcurrent").firstElementChild);
            for (let i = 2; i < arr.length; i++)
                playlistPlayMedia(deduceMedia(arr[i]));
            plname.innerText = arr[0];
            plname.dataset.name = arr[0];
            plname.dataset.id = id;
            playlistLock = true;
        }).remove);
    }
    return function() {
        for (let i = 0; i < removers.length; i++) removers[i]();
    }
}

function populateFilesystem(fs) {
    function populateFolder(fs, name, path, begin) {
        // i am inside a folder, figure out where it ends
        let end = begin;
        if (path.length) {
            for (; end < library.lib.length; end++)
                if (!library.lib[end].startsWith(path))
                    break;
        } else {
            end = library.lib.length;
        }
        let foldersrc = [];
        // unless i am root, create the folder object and 
        if (name.length) {
            fs = fs.addFolder(name, storage.getb("folders",path,false), function(isopen){
                storage.setb("folders", path, isopen);
            }, function() {
                if (foldersrc.length === 0) return;
                delete plname.dataset.name;
                delete plname.dataset.id;
                playlistSetLock(true);
                playlistLock = false;
                playlistPlayNone();
                playlistClearPlaylist();
                playlistPlayMedia(deduceMedia(foldersrc[0]));
                playlistPlayCard(document.getElementById("vcurrent").firstElementChild);
                for (let i = 1; i < foldersrc.length; i++)
                    playlistPlayMedia(deduceMedia(foldersrc[i]));
                plname.innerText = name;
                plname.dataset.name = name;
                playlistLock = true;
            });
        }
        for (let i = begin; i < end; i++) {
            let pos = library.lib[i].indexOf('/',path.length);
            if (pos !== -1) { // folder
                i = populateFolder(fs,library.lib[i].substr(path.length, pos - path.length), library.lib[i].substr(0, pos + 1), i) - 1;
                continue;
            }
            pos = library.lib[i].lastIndexOf('.');
            if (pos != -1) {
                let ext = library.lib[i].substr(pos + 1);
                if (library.track_ext.indexOf(ext) != -1 || library.movie_ext.indexOf(ext) != -1) {
                    foldersrc.push(library.lib[i]);
                    let lyrics = null;
                    for (let j = 0; j < library.lyrics_ext.length; j++) {
                        let index = findlib(library.lib[i].substr(0,pos + 1) + library.lyrics_ext);
                        if (index != -1) {
                            lyrics = library.prefix + library.lib[index];
                            break;
                        }
                    }
                    let media = deduceMedia(library.lib[i]);
                    if (media.type === "audio") {
                        fs.addFile(media.title,
                            function(){ playlistPlayMedia(deduceMedia(library.lib[i])); },
                            (lyrics === null ? undefined : function(){ showLyrics(lyrics); }),
                            false
                        );
                    } else if (media.type === "video") {
                        let progress = videoGetProgress(library.prefix + library.lib[i]);
                        let file = fs.addFile(media.title,
                            function(){ videoPlay(library.prefix + library.lib[i]); },
                            function(){ videoToggleProgress(library.prefix + library.lib[i]); },
                            true
                        );
                        file.elem.style.setProperty("--v",(100 * progress) + "%");
                        videoGetDuration(library.prefix + library.lib[i]).then(function (v) {
                            file.setcap(toTimestamp(Math.floor(v)));
                        });
                        filedb[library.prefix + library.lib[i]] = file;
                    }
                }
            }
        }
        return end;
    }
    populateFolder(fs, "", "", 0);
    let scrolltop = storage.get("global","fsscroll",0,Number);
    if (scrolltop) {
        let filesystem = document.getElementById("filesystem");
        filesystem.scrollTop = scrolltop;
    }
}

function playlistPrepareDrop() {
    if (MOBILE) return;
    let trashbin = document.body;
    let playlist = document.getElementById("playlist");
    let queue = document.getElementById("queue");
    function ondrop(ev){
        if (drag) {
            if (ev.target === queue) {
                queue.append(drag);
            } else {
                drag.remove();
                if (drag.id === "current") {
                    playlistPlayNone();
                }
                if (queue.childElementCount === 0) {
                    all.classList.add('plempty');
                    deletePlaylistStorage();
                } else {
                    updatePlaylistStorage();
                }
            }
            drag = null;
            ev.preventDefault();
            updatePlaylistStorage();
        }
    }
    trashbin.addEventListener('dragover', function(ev){ev.preventDefault();});
    trashbin.addEventListener('drop', ondrop);
    queue.addEventListener('dragover', function(ev){ev.preventDefault();});
    queue.addEventListener('drop', ondrop);
}

let scroll_id = 0;
let scroll_v = 0;
function setQueueScroll(v) {
    const mult = 1;
    if (v) {
        scroll_v = v;
        if (!scroll_id) {
            let queue = document.getElementById("queue");
            scroll_id = setInterval(function(){
                queue.scrollBy(0,scroll_v * mult);
            },25);
        }
    } else if (scroll_id) {
        clearInterval(scroll_id);
        scroll_id = 0;
    }
}

function playlistSetLock(value) {
    if (playlistLock === value) return;
    playlistLock = value;
    let ctledit = document.getElementById("ctledit");
    if (value === false) ctledit.innerHTML = "&#xf1c0;"; //DATABASE
    else if (value === true) ctledit.innerHTML = "&#xf023;"; //LOCK
    else ctledit.innerHTML = "&#xf09c;"; //UNLOCK
}

function playlistCreateCard(media, draggable) {
    let img = create('img'); img.setAttribute('src', media.img);
    let title = create('div','title'); title.innerText = media.title;
    let desc = create('div','desc'); desc.innerText = media.folder;
    let card = create('div','card', img, create('div','info',title,desc), create('div','playedtag'));
    let lastclicktime = -10000;
    card.dataset.src = media.src;
    card.addEventListener('click',function(){
        if (card.parentElement.id === "vcurrent") {
            let currenttime = performance.now();
            if (MOBILE && currenttime - lastclicktime < 300) {
                playlistSetLock(false);
                playlistPlayCard(card);
            }
            lastclicktime = currenttime;
            document.getElementById("button").dispatchEvent(new Event('click'));
        } else {
            if (card.id === "current") {
                document.getElementById("button").dispatchEvent(new Event('click'));
            } else {
                playlistPlayCard(card);
            }
        }
    });
    card.addEventListener('dblclick',function(){
        playlistPlayCard(card);
    });
    function ondragstart(ev) {
        if (playlistLock) {
            ev.preventDefault();
            ev.stopPropagation();
            return;
        }
        if (card.parentElement.id !== "vcurrent") {
            drag = card;
            beginDragStyle(card, ev);
        }
        //console.log(ev);
        ev.dataTransfer.clearData();
        ev.dataTransfer.setDragImage(card.firstElementChild, 10, 10);
    }
    function ondragover(ev,card,drag) {
        if (!MOBILE) {
            if (card.parentElement.id === "vcurrent") return false;
            if (card === drag || drag === null) return false;
        }
        //if (card === drag.previousElementSibling) {
        //    console.log("ABOVE");
        //} else if (card === drag.nextElementSibling) {
        //    console.log("BELOW");
        //} else {
        //    let rect = card.getBoundingClientRect();
        //    if ((ev.clientY - rect.top) < ((rect.bottom - rect.top) * 0.5)) {
        //        console.log("ABOVE");
        //    } else {
        //        console.log("BELOW");
        //    }
        //}
        ev.preventDefault();
    }
    function ondrop(ev,card,drag) {
        if (!MOBILE) {
            if (card.parentElement.id === "vcurrent") return false;
            if (card === drag || drag === null) return false;
        }
        if (card === drag.previousElementSibling) {
            card.insertAdjacentElement('beforebegin',drag);
        } else if (card === drag.nextElementSibling) {
            card.insertAdjacentElement('afterend',drag);
        } else {
            let rect = card.getBoundingClientRect();
            if ((ev.clientY - rect.top) < ((rect.bottom - rect.top) * 0.5)) {
                card.insertAdjacentElement('beforebegin',drag);
            } else {
                card.insertAdjacentElement('afterend',drag);
            }
        }
        updatePlaylistStorage();
        endDragStyle(drag);
        ev.preventDefault();
        return true;
    }
    let imgdragx = 0;
    let imgdragy = 0;
    let imgdrag = document.body;
    imgdrag = null;
    function beginDragStyle(card, ev) {
        card.classList.add("drag");
        if (!MOBILE) return;
        if (ev.type.startsWith("touch")) ev = ev.changedTouches[0];
        let img = card.firstElementChild;
        let rect = img.getBoundingClientRect();
        imgdrag = document.createElement("img");
        imgdrag.src = img.src;
        imgdrag.style.position = 'absolute';
        imgdrag.style.width = rect.width + 'px';
        imgdrag.style.height = rect.height + 'px';
        imgdrag.style.opacity = '0.5';
        imgdrag.style.pointerEvents = 'none';
        imgdrag.style.left = rect.left + 'px';
        imgdrag.style.top = rect.top + 'px';
        //imgdragx = rect.width / 2;
        //imgdragy = rect.height / 2;
        imgdragx = ev.clientX - rect.left;
        imgdragy = ev.clientY - rect.top;
        document.body.append(imgdrag);
    }
    function endDragStyle(card) {
        card.classList.remove("drag");
        card.scrollIntoView({"block":"nearest","behavior":"smooth"});
        if (!imgdrag) return;
        imgdrag.remove();
        imgdrag = null;
    }
    document.addEventListener(MOBILE ? 'touchmove' : 'mousemove', function (ev) {
        if (!imgdrag) return;
        if (ev.type.startsWith("touch")) ev = ev.changedTouches[0];
        let x = ev.clientX - imgdragx;
        let y = ev.clientY - imgdragy;
        imgdrag.style.left = x + 'px';
        imgdrag.style.top = y + 'px';
    });
    if (MOBILE) {
        function ontouchstart(ev) {
            if (playlistLock) return;
            if (card.parentElement.id !== "vcurrent") {
                let touch = ev.changedTouches[0];
                let elem = document.elementFromPoint(touch.clientX,touch.clientY);
                if (elem.tagName === "IMG") {
                    beginDragStyle(card, ev);
                    ev.preventDefault();
                }
            }
        }
        function ontouch(ev) {
            if (playlistLock) return;
            if (!card.classList.contains("drag")) return;
            let isend = ev.type === "touchend";
            let touch = ev.changedTouches[0];
            let elem = document.elementFromPoint(touch.clientX,touch.clientY);
            if (isend) {
                endDragStyle(card);
                setQueueScroll(0);
            } else {
                const size = 40;
                const mult = 0.6;
                const base = 10;
                let rect = document.getElementById("queue").getBoundingClientRect();
                //console.log(touch.clientY - rect.top, rect.bottom - touch.clientY);
                let v = touch.clientY - rect.top;
                if (touch.clientY > rect.top && touch.clientY - rect.top < size) {
                    let c = touch.clientY - rect.top - size;
                    //console.log("top", c);
                    //setQueueScroll(touch.clientY - (rect.top - size) * mult - base);
                    setQueueScroll(c * mult - base);
                } else if (rect.bottom > touch.clientY && rect.bottom - touch.clientY < size) {
                    let c = touch.clientY - rect.bottom + size;
                    //console.log("bottom", c);
                    //setQueueScroll(touch.clientY + (size - rect.bottom) * mult + base);
                    setQueueScroll(c * mult + base);
                } else {
                    setQueueScroll(0);
                }
            }
            if (card.parentElement.id === "vcurrent")  {
                do {
                    elem = elem.parentElement;
                    if (!elem) return;
                } while (elem.id !== "filesystem");
                if (isend)
                    playlistPlayNone();
            } else {
                while (elem) {
                    if (elem.classList.contains('card')) {
                        if (elem === card) return;
                        (isend ? ondrop : ondragover)({
                            clientY: touch.clientY,
                            preventDefault: function(){}
                        }, elem, card);
                        return;
                    }
                    if (elem.id === "queue") {
                        if (isend) {
                            elem.append(card);
                            updatePlaylistStorage();
                        } else {
                            //console.log("LAST");
                        }
                        return;
                    }
                    elem = elem.parentElement;
                }
            }
            if (isend) {
                card.remove();
                if (card.id === "current")
                    playlistPlayNone();
                if (document.getElementById("queue").childElementCount === 0) {
                    all.classList.add('plempty');
                    deletePlaylistStorage();
                } else {
                    updatePlaylistStorage();
                }
            } else {
                //console.log("REMOVE");
            }
        }
        card.addEventListener('touchstart', ontouchstart);
        card.addEventListener('touchmove', ontouch);
        card.addEventListener('touchend', ontouch);
    } else {
        if (draggable) card.setAttribute('draggable','true');
        card.addEventListener('dragstart', ondragstart);
        card.addEventListener('dragover', function(ev){ondragover(ev,card,drag);});
        card.addEventListener('drop', function(ev){if (ondrop(ev,card,drag)) drag = null;});
    }
    return card;

}

function playlistPlayCard(card) {
    if (card.parentElement === null) {
        console.log("BREAK");
        null();
    }
    if (card.parentElement.id === "vcurrent") {
        let plname = document.getElementById("plname");
        plname.innerText = "";
        delete plname.dataset.name;
        delete plname.dataset.id;
        if (!all.classList.contains("plempty")) return;
        all.classList.remove("plempty");
        setupMediaMetadata(true);
        let queue = document.getElementById("queue");
        card.id = "current";
        card.setAttribute('draggable','true');
        all.classList.remove('hasvc');
        queue.append(card);
        updatePlaylistStorage();
    } else {
        all.classList.remove('nolocal');
        let slider = document.getElementById("localbar");
        slider.style.animation = "";
        slider.firstElementChild.style.animation = "";
        let current = document.getElementById("current");
        if (current === card) {
            current.classList.remove("played");
            return;
        }
        if (current !== null) current.id = "";
        card.id = "current";
        loadtrack(card.dataset.src);
    }
}

function playlistPlayMedia(media) {
    let main = document.getElementById("main");
    all.classList.remove('nolocal');
    let slider = document.getElementById("localbar");
    slider.style.animation = "";
    slider.firstElementChild.style.animation = "";
    if (!all.classList.contains('plempty')) {
        if (!playlistLock)
            return playlistPushBack(media, false);
        playlistClearPlaylist();
    }
    let vcur = document.getElementById("vcurrent");
    all.classList.add('hasvc');
    if (vcur.firstElementChild)
        vcur.firstElementChild.remove();
    vcur.append(playlistCreateCard(media, false));
    loadtrack(media.src);
}

function playlistPushBack(media, play) {
    let card = playlistCreateCard(media, true);
    document.getElementById("queue").append(card);
    all.classList.remove('plempty');
    if (play) playlistPlayCard(card);
    updatePlaylistStorage();
}

function playlistPushFront(media, play) {
    let card = playlistCreateCard(media, true);
    document.getElementById("queue").prepend(card);
    all.classList.remove('plempty');
    if (play) playlistPlayCard(card);
    updatePlaylistStorage();
}

function playlistClearPlayed() {
    let children = document.getElementById("queue").children;
    for (let i = 0; i < children.length; i++)
        children[i].classList.remove("played");
}

function playlistPlayNext(force) {
    let queue = document.getElementById("queue");
    if (queue.firstElementChild === null) return false;
    let card = document.getElementById("current");
    if (document.getElementById("ctlshuffle").classList.contains('checked')) {
        let children = queue.children;
        if (children.length > 1) {
            card.classList.add("played");
            let available = [];
            for (let i = 0; i < children.length; i++) {
                if (!children[i].classList.contains("played")) {
                    available.push(children[i]);
                }
            }
            if (available.length === 0) {
                // all tracks have been played
                if (!force && !document.getElementById("ctlloop").classList.contains('checked')) {
                    for (let i = 0; i < children.length; i++)
                        children[i].classList.remove("played");
                    return false;
                }
                for (let i = 0; i < children.length; i++) {
                    if (children[i] !== card) {
                        children[i].classList.remove("played");
                        available.push(children[i]);
                    }
                }
            }
            card.id = "";
            card = available[Math.floor(available.length * Math.random())];
            card.id = "current";
        }
    } else {
        if (card === null) {
            card = queue.firstElementChild;
            if (card === null) return false;
        } else if (card.nextElementSibling === null) {
            if (!force && !document.getElementById("ctlloop").classList.contains('checked'))
                return false;
            card.id = ""; card = queue.firstElementChild;
        } else {
            card.id = ""; card = card.nextElementSibling;
        }
    }
    card.id = "current";
    card.scrollIntoView({"block":"center","behavior":"smooth"});
    loadtrack(card.dataset.src);
    return true;
}

function playlistPlayPrevious(force) {
    let playlist = document.getElementById("queue");
    if (playlist.firstElementChild === null) return;
    if (document.getElementById("ctlshuffle").classList.contains('checked'))
        return playlistPlayNext(force);
    let card = document.getElementById("current");
    if (card === null) {
        card = playlist.lastElementChild;
    } else if (card.previousElementSibling === null) {
        card.id = ""; card = playlist.lastElementChild;
    } else {
        card.id = ""; card = card.previousElementSibling;
    }
    card.id = "current";
    loadtrack(card.dataset.src);
    return true;
}

function playlistPlayNone() {
    let card = document.getElementById("current");
    if (card !== null) card.id = "";
    loadtrack(null);
    all.classList.add('nolocal');
    let vcur = document.getElementById("vcurrent");
    all.classList.remove('hasvc');
    all.classList.add('nolocal');
    if (vcur.firstElementChild)
        vcur.firstElementChild.remove();
}

function playlistClearPlaylist() {
    let current = document.getElementById("current");
    if (current) {
        let vcur = document.getElementById("vcurrent");
        all.classList.add('hasvc');
        if (vcur.firstElementChild)
            vcur.firstElementChild.remove();
        vcur.append(current);
    }
    let queue = document.getElementById("queue");
    while (queue.lastElementChild)
        queue.lastElementChild.remove();
    all.classList.add('plempty');
    setupMediaMetadata(true);
    updatePlaylistStorage();
}

function setButtonIcon(icon) {
    let button = document.getElementById("button");
    button.classList.remove('readonly');
    button.classList.toggle('loading', icon === 'loading');
    if (icon === 'play') {
        button.innerHTML = "&#xf04b;";
    } else if (icon === 'pause') {
        button.innerHTML = "&#xf04c;";
    } else if (icon === 'loading') {
        button.innerHTML = "&#xf110;";
    } else if (icon === 'retry') {
        button.innerHTML = "&#xf01e;";
    } else if (icon === 'restart') {
        button.innerHTML = "&#xf01e;";
    }
}

function setupAudio() {
    let bar = document.getElementById("bar");
    let button = document.getElementById("button");
    let timestamp = document.getElementById("timestamp");
    let slider = document.getElementById("mainslider");
    let held = false; let lastdrag = 0;
    let canplay = false;
    let duration = 0;
    let current = 0;
    let useRemaining = storage.getb("global","useremaining",false);
    let lastTimestampText = '';
    let lastloadedsrc = null;
    let globalvolume = storage.get("global","volume",1,Number);
    let setlocalvolume = null;
    if (useRemaining)
        timestamp.innerText = "-0:00 / 0:00";
    function updateTimestamp() {
        let timestamp = document.getElementById("timestamp");
        let v = 100 * current / duration;
        slider.style.setProperty('--v', (Number.isNaN(v) ? '0%' : v + '%'));
        let s = "";
        if (useRemaining) {
            if (duration == current) {
                s = '0:00'
            } else if (duration > current) {
                s = '-' + toTimestamp(duration - current);
            } else {
                s = '+' + toTimestamp(current - duration);
            }
        } else {
            s = toTimestamp(current);
        }
        s = s + ' / ' + toTimestamp(duration);
        if (lastTimestampText === s) return;
        timestamp.innerText = s;
        lastTimestampText = s;
    }
    audio_updateTimestamp = updateTimestamp;
    function playpause() {
        if (!audio) return;
        if (audio.ended) {
            current = 0;
            updateTimestamp();
            audio.currentTime = 0;
            audio.play();
            setButtonIcon('pause');
        } else if (audio.paused) {
            audio.play();
            setButtonIcon('pause');
            current = audio.currentTime;
            updateTimestamp();
        } else {
            audio.pause();
            setButtonIcon('play');
            current = audio.currentTime;
            updateTimestamp();
        }
    }
    function load(src) {
        lastloadedsrc = null;
        if (audio) deleteaudio();
        //setlocalvolume(0);
        let localvolume = storage.get("fv", src, 0.25, Number); // TODO load localvolume from user config or something
        setlocalvolume(localvolume, true);
        lastloadedsrc = src;
        canplay = false;
        bar.classList.add("readonly");
        held = false;
        slider.style.setProperty('--v','0%');
        current = 0;
        duration = 0;
        if (typeof src !== "string") {
            setupMediaMetadata(null);
            setButtonIcon('play');
            updateTimestamp();
            return;
        }
        setupMediaMetadata(src);
        audio = new Audio();
        audio.volume = localvolume * globalvolume >= 1 ? 1 : localvolume * globalvolume;
        audio.src = src;
        setButtonIcon('loading');
        deleteaudio = function() {
            audio.removeEventListener('loadeddata', onloadeddata);
            audio.removeEventListener('timeupdate', ontimeupdate);
            audio.removeEventListener('ended', onended);
            audio.removeEventListener('error', onerror);
            audio.src = '';
            audio = null;
            deleteaudio = null;
        }
        audio.addEventListener('loadeddata', onloadeddata);
        audio.addEventListener('timeupdate', ontimeupdate);
        audio.addEventListener('ended', onended);
        audio.addEventListener('error', onerror);
        audio.load();
        function onloadeddata(ev) {
            audio.play();
            canplay = true;
            bar.classList.remove("readonly");
            setButtonIcon('pause');
            duration = audio.duration;
            updateTimestamp();
        }
        function ontimeupdate(ev) {
            if (held) return
            current = audio.currentTime;
            updateTimestamp();
        }
        function onended(ev) {
            if (!playlistPlayNext()) {
                if (!document.getElementById("ctlloop").classList.contains('checked')) {
                    setButtonIcon('restart');
                } else {
                    audio.currentTime = 0;
                    current = 0;
                    updateTimestamp();
                    audio.play();
                }
            }
        }
        function onerror(ev) {
            console.log(ev);
            setButtonIcon('retry');
        }
    }
    loadtrack = load;
    button.addEventListener('click', playpause);
    document.addEventListener('keydown', ev => {
        if (ev.keyCode === 32) {
            playpause();
            ev.preventDefault();
        }
    });
    timestamp.addEventListener('click', () => {
        useRemaining = !useRemaining;
        storage.setb("global","useremaining",useRemaining);
        updateTimestamp();
    });
    function getSlide(ev,elem) {
        //console.log(ev);
        if (ev.type.startsWith('touch'))
            ev = ev.changedTouches[0];
        let rect = elem.getBoundingClientRect();
        let v = (ev.pageX - rect.left) / (rect.right - rect.left);
        if (v < 0) return 0;
        if (v > 1) return 1;
        return v;
    }
    function onmousedown(ev) {
        if (!canplay) return;
        if (ev.target !== slider || held) return;
        current = getSlide(ev, slider) * duration;
        updateTimestamp();
        ev.preventDefault();
        held = true;
    }
    function onmousemove(ev) {
        if (!held) return;
        let istouch = ev.type.startsWith('touch');
        if (!ev.which && !istouch) {
            held = false;
            return;
        }
        current = getSlide(ev, slider) * duration;
        updateTimestamp();
        if (!istouch) ev.preventDefault();
    }
    function onmouseup(ev) {
        if (!held) return;
        current = getSlide(ev, slider) * duration;
        audio.currentTime = current;
        updateTimestamp();
        ev.preventDefault();
        held = false;
    }
    slider.addEventListener('mousedown',onmousedown);
    document.body.addEventListener('mousemove',onmousemove);
    document.body.addEventListener('mouseup',onmouseup);
    slider.addEventListener('touchstart',onmousedown);
    document.body.addEventListener('touchmove',onmousemove);
    document.body.addEventListener('touchend',onmouseup);
    function setupVolumeSlider(slider,getmaxvol,callback) {
        let held = false;
        let amps = 0;
        let volume = 0;
        function setmax() {
            let max = getmaxvol();
            if (amps + volume <= max) return;
            if (max === 0) {
                volume = 0;
                amps = 0;
            } else if (Number.isInteger(max)) {
                volume = 1;
                amps = max - 1;
            } else {
                volume = max % 1;
                amps = Math.floor(max);
            }
            slider.classList.toggle("amped",amps);
        }
        function onfix(action) {
            if (action === undefined) {
                if (volume === 0) {
                    if (amps === 0) return;
                    action = "-";
                    volume = 1;
                    slider.style.setProperty('--v', '100%');
                    slider.firstElementChild.style.animation = "";
                    setTimeout(function(){
                        slider.firstElementChild.style.animation = "amp-sliderdiv-flash 0.4s linear 1 reverse";
                    },1);
                } else if (volume === 1) {
                    action = "+";
                    volume = 0;
                    slider.style.setProperty('--v', '0%');
                    slider.firstElementChild.style.animation = "";
                    setTimeout(function(){
                        slider.firstElementChild.style.animation = "amp-sliderdiv-flash 0.4s linear 1";
                    },1);
                }
            }
            if (action === "-") {
                if (amps === 0) return;
                slider.style.animation = "";
                setTimeout(function(){
                    slider.style.animation = "amp-flash 0.4s linear 1 reverse";
                },1);
                amps--; // decrement amps
            } else if (action === "+") {
                slider.style.animation = "";
                setTimeout(function(){
                    slider.style.animation = "amp-flash 0.4s linear 1";
                },1);
                amps++; // increment amps
            } else {
                slider.firstElementChild.style.animation = "";
                setTimeout(function(){slider.firstElementChild.style.animation = "nice-flash 0.5s linear";},1);
                // fix volume
                //const nice = [0.05,0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45,0.50,0.65,0.70,0.75,0.80,0.85,0.90,0.95,0.96,0.97,0.98,0.99,0.100];
                //let bestdist = Math.abs(nice[0] - volume);
                //let best = nice[0];
                //for (let i = 1; i < nice.length; i++) {
                //    let dist = Math.abs(nice[i] - volume);
                //    if (bestdist > dist) {
                //        best = nice[i];
                //        bestdist = dist;
                //    }
                //}
                //volume = best;
                volume = Math.round(volume * 20) * 0.05
                setmax();
                slider.style.setProperty('--v', volume * 100 + '%');
            }
            slider.classList.toggle("amped",amps);
            callback(volume + amps);
        }
        let lastclicktime = -10000;
        let lastclickvol = volume;
        function onmousedown(ev) {
            if (ev.target !== slider || held) return;
            if (performance.now() - lastclicktime < 300) {
                volume = lastclickvol;
                slider.style.setProperty('--v', volume * 100 + '%');
                if (ev.type.startsWith('touch'))
                    ev = ev.changedTouches[0];
                let rect = slider.getBoundingClientRect();
                let x = (ev.pageX - rect.left) / (rect.right - rect.left);
                if (x < 1/3) {
                    onfix("-");
                } else if (x > 2/3) {
                    onfix("+");
                } else {
                    onfix(" ");
                }
                lastclicktime = -10000;
                return;
            }
            lastclickvol = volume;
            lastclicktime = performance.now();
            volume = getSlide(ev, slider);
            setmax();
            slider.style.setProperty('--v', volume * 100 + '%');
            ev.preventDefault();
            held = true;
            callback(volume + amps);
        }
        function onmousemove(ev) {
            if (!held) return;
            let istouch = ev.type.startsWith('touch');
            if (!ev.which && !istouch) {
                held = false;
                return;
            }
            volume = getSlide(ev, slider);
            setmax();
            slider.style.setProperty('--v', volume * 100 + '%');
            if (!istouch) ev.preventDefault();
            callback(volume + amps);
        }
        function onmouseup(ev) {
            if (!held) return;
            volume = getSlide(ev, slider);
            setmax();
            slider.style.setProperty('--v', volume * 100 + '%');
            ev.preventDefault();
            held = false;
            callback(volume + amps);
        }
        if (!MOBILE) {
            slider.addEventListener('mousedown',onmousedown);
            document.body.addEventListener('mousemove',onmousemove);
            document.body.addEventListener('mouseup',onmouseup);
        } else {
            slider.addEventListener('touchstart',onmousedown);
            document.body.addEventListener('touchmove',onmousemove);
            document.body.addEventListener('touchend',onmouseup);
        }
        document.getElementById('volumenums').addEventListener('click',function(ev) {
            if (!all.classList.contains('nolocal')) {
                if (ev.type.startsWith('touch'))
                    ev = ev.changedTouches[0];
                let rect = document.getElementById('volumenums').getBoundingClientRect();
                if (slider.id === ((ev.pageY * 2 > rect.top + rect.bottom) ? "globalbar" : "localbar")) onfix();
            } else {
                if (slider.id === "globalbar") onfix();
            }
        });
        return function(value,callcallback){
            if (value < 0) return;
            if (value === 0) {
                volume = 0;
                amps = 0;
            } else if (Number.isInteger(value)) {
                volume = 1;
                amps = value - 1;
            } else {
                volume = value % 1;
                amps = Math.floor(value);
            }
            slider.classList.toggle("amped",amps);
            slider.style.setProperty('--v', volume * 100 + '%');
            if (callcallback) callback(volume + amps);
        };
    }
    let localvolume = 0;
    let vcontrolsb = document.getElementById("vcontrolsb");
    let localnum = document.getElementById("localnum");
    let globalnum = document.getElementById("globalnum");
    setlocalvolume = setupVolumeSlider(document.getElementById("localbar"),function(){return 1 / globalvolume;},function(v) {
        vcontrolsb.style.setProperty('--vr', (globalvolume * v > 1 ? 1 : globalvolume * v) * 100 + '%');
        v = Math.round(v * 100) * 0.01;
        if (lastloadedsrc !== null)
            storage.set("fv",lastloadedsrc,v);
        localvolume = v;
        localnum.innerText = Math.round(v*100) + '%';
        let vr = localvolume * globalvolume > 1 ? 1 : localvolume * globalvolume;
        if (audio) audio.volume = vr;
    });
    setupVolumeSlider(document.getElementById("globalbar"),function(){return 1 / localvolume;},function(v) {
        vcontrolsb.style.setProperty('--vr', (localvolume * v > 1 ? 1 : localvolume * v) * 100 + '%');
        v = Math.round(v * 100) * 0.01;
        storage.set("global","volume",v);
        globalvolume = v;
        globalnum.innerText = Math.round(v*100) + '%';
        let vr = localvolume * globalvolume > 1 ? 1 : localvolume * globalvolume;
        if (audio) audio.volume = vr;
    })(globalvolume, true);
}

function setupMediaMetadata(src) {
    if (!('mediaSession' in navigator)) return;
    if (!src) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler("nexttrack",null);
        navigator.mediaSession.setActionHandler("previoustrack",null);
        navigator.mediaSession.setActionHandler("pause",null);
        navigator.mediaSession.setActionHandler("play",null);
        return;
    }
    if (typeof src === "string") {
        let media = deduceMedia(src);
		//let artwork = [{ src: media.img }];
		let artwork = [{ src: library.prefix + "thumbnail.png" }];
		if (location.protocol === 'file:') {
			artwork = undefined;
		}
		navigator.mediaSession.metadata = new MediaMetadata({
			title: media.title,
			artist: media.folder,
			//album: media.folder,
			artwork: artwork,
		});
    }
    navigator.mediaSession.setActionHandler("nexttrack", all.classList.contains("plempty") ? null : nexttrack);
    navigator.mediaSession.setActionHandler("previoustrack", all.classList.contains("plempty") ? null : previoustrack);
    navigator.mediaSession.setActionHandler("pause",pause);
    navigator.mediaSession.setActionHandler("play",play);
    function nexttrack() {
        if (!all.classList.contains("plempty"))
            playlistPlayNext(true);
    }
    function previoustrack() {
        if (!all.classList.contains("plempty"))
            playlistPlayPrevious(true);
    }
    function pause() {
        if (audio) {
            audio.pause();
            setButtonIcon('play');
            current = audio.currentTime;
            audio_updateTimestamp();
        }
    }
    function play() {
        if (audio) {
            audio.play();
            setButtonIcon('pause');
            current = audio.currentTime;
            audio_updateTimestamp();
        }
    }
}

function showPLedit(name,allowdelete,callback,validate) {
    let pldlg = document.getElementById("pldlg");
    let pledit = document.getElementById("pledit");
    let plconfirm = document.getElementById("plconfirm");
    let editok = document.getElementById("editok");
    let editdel = document.getElementById("editdel");
    let editname = document.getElementById("editname");
    const finish = function(value){
        pldlg.removeEventListener("click",onIgnore);
        editok.removeEventListener("click",onConfirm);
        editdel.removeEventListener("click",onDelete);
        editname.removeEventListener("keydown",onInput);
        editname.removeEventListener("input",onInput);
        pldlg.classList.remove("show");
        callback(value);
    };
    const onIgnore  = function(){ finish(false); };
    const onConfirm = function(){ finish(editname.value); };
    const onDelete  = function(){ finish(true); };
    const onInput = function(ev) {
        let value = editname.value;
        editok.classList.toggle("disabled",!value.length || (typeof validate === "function" && !validate(value)));
        if (ev.type === "keydown") {
            if (ev.keyCode === 27) finish(false);
            if (ev.keyCode === 13 || ev.keyCode === 10) finish(value);
        }
    }
    editname.value = name;
    editdel.classList.toggle("hide",!allowdelete);
    pledit.classList.remove("hide");
    plconfirm.classList.add("hide");
    pldlg.classList.add("show");
    editok.classList.toggle("disabled",!name.length);
    pldlg.addEventListener("click",onIgnore);
    editok.addEventListener("click",onConfirm);
    editdel.addEventListener("click",onDelete);
    editname.addEventListener("keydown",onInput);
    editname.addEventListener("input",onInput);
    editname.focus();
}

function showPLconfirm(message,callback) {
    let pldlg = document.getElementById("pldlg");
    let pledit = document.getElementById("pledit");
    let plconfirm = document.getElementById("plconfirm");
    let conflbl = document.getElementById("conflbl");
    let confok = document.getElementById("confok");
    let confcanc = document.getElementById("confcanc");
    const finish = function(value){
        pldlg.removeEventListener("click",onIgnore);
        confok.removeEventListener("click",onConfirm);
        confcanc.removeEventListener("click",onIgnore);
        pldlg.classList.remove("show");
        callback(value);
    };
    const onIgnore = function(){ finish(false); };
    const onConfirm = function(){ finish(true); };
    conflbl.innerText = message;
    pledit.classList.add("hide");
    plconfirm.classList.remove("hide");
    pldlg.classList.add("show");
    pldlg.addEventListener("click",onIgnore);
    confok.addEventListener("click",onConfirm);
    confcanc.addEventListener("click",onIgnore);
}

function createNewPlaylistStorage(value) {
    let i = 1;
    while (storage.get("pl","" + i,undefined) !== undefined) i++;
    let cards = document.getElementById("queue").children;
    let s = value;
    for (let j = 0; j < cards.length; j++)
        s = s + ':' + removeprefix(cards[j].dataset.src);
    storage.set("pl","" + i,s);
    let plname = document.getElementById("plname");
    plname.innerText = value;
    plname.dataset.name = value;
    plname.dataset.id = i;
    repopulatePlaylists();
}

function updatePlaylistStorage() {
    let plname = document.getElementById("plname");
    if (typeof plname.dataset.id !== "string") return;
    let s = plname.dataset.name;
    let cards = document.getElementById("queue").children;
    for (let j = 0; j < cards.length; j++)
        s = s + ':' + removeprefix(cards[j].dataset.src);
    if (s.indexOf(":") === -1) {
        return;
    }
    //console.log("UPDATED " + plname.dataset.id + " TO " + s);
    storage.set("pl",plname.dataset.id,s);
    repopulatePlaylists();
}

function deletePlaylistStorage() {
    playlistPlayNone();
    playlistClearPlaylist();
    let plname = document.getElementById("plname");
    if (typeof plname.dataset.id !== "string") return;
    let i = Number(plname.dataset.id);
    while (true) {
        let v = storage.get("pl","" + (i + 1),undefined);
        storage.set("pl","" + i++, v);
        if (v === undefined) break;
    }
    repopulatePlaylists();
}

function showLyrics(path) {
    if (all.classList.contains('show-lyrics')) {
        document.body.classList.add('loading');
        all.classList.remove('show-lyrics');
        all.classList.add('hide-lyrics');
        document.getElementById("lyricstext").innerHTML = "";
        setTimeout(function(){
            document.body.classList.remove('loading');
        },250);
        return;
    }
    if (!path) return;
    let text = lyricsdb[path];
    if (text === undefined) {
        gl = callback;
        let script = document.createElement("script");
        script.src = path;
        document.head.append(script);
        function callback(text){
            gl = null;
            script.remove();
            if (text.startsWith('\n')) {
                text = text.slice(1);
            }
            if (text.endsWith('\n')) {
                text = text.slice(0,-1);
            }
            lyricsdb[path] = text;
            showLyrics(path);
        };
        return;
    }
    let lyrics = document.getElementById("lyricstext");
    all.classList.remove('hide-lyrics');
    all.classList.add('show-lyrics');
    let italic = false;
    let bold = false;
    let underline = false;
    function processLine(elem, text, style) {
        let n = text.indexOf("*");
        function count(text,index) {
            let total = 0;
            while (index < text.length && text[index] == "*") {
                total++;
                index++;
            }
            return total;
        }
        function put(text) {
            let span = document.createElement('span');
            if (italic) span.classList.add("italic");
            if (bold) span.classList.add("bold");
            if (underline) span.classList.add("underline");
            span.innerText = text;
            elem.append(span);
        }
        if (n === -1) {
            if (!italic && !bold && !underline) {
                elem.innerText = text;
            } else {
                put(text);
            }
        } else {
            let last = 0;
            while (1) {
                put(text.slice(last,n));
                if (n === -1) {
                    break;
                }
                let c = count(text,n);
                if (c === 1) {
                    italic = !italic;
                } else if (c === 2) {
                    bold = !bold;
                } else if (c === 3) {
                    underline = !underline;
                }
                last = n + c;
                n = text.indexOf("*", n + c);
            }
        }
        if (style['color'] !== undefined) {
            elem.style.color = style['color'];
        } else if (style['align'] !== undefined) {
            elem.style.textAlign = style['align'];
        } else if (style['size'] !== undefined) {
            elem.style.fontSize = style['size'];
        } else if (style['font'] !== undefined) {
            elem.style.fontFamily = style['font'];
        }
    }
    lyrics.innerHTML = "";
    let lines = text.split('\n');
    let style = {};
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.startsWith('@#:')) {
            if (line.length === 3) {
                delete style['color'];
            } else {
                style['color'] = line.substr(3).toLowerCase();
            }
        } else if (line.startsWith('@#')) {
            if (line.length === 2) {
                delete style['color'];
            } else {
                style['color'] = line.substr(1).toLowerCase();
            }
        } else if (line.startsWith('@')) {
            if (line === '@') { // reset all attributes
                style = {};
            } else if (line === '@:') { // reset all attributes but color
                if (style.color !== undefined) {
                    style = {color:style.color};
                } else {
                    style = {};
                }
            } else if (line === '@*') { // reset * modifiers
                italic = false;
                bold = false;
                underline = false;
            } else {
                let n = line.indexOf(':');
                line = line.toLowerCase();
                if (n > 1) {
                    if (n === -1 || n === line.length - 1) {
                        delete style[line.substr(1)];
                    } else {
                        style[line.substr(1,n - 1)] = line.substr(n + 1)
                    }
                }
            }
        } else if (line.startsWith('>')) {
            let p = lyrics.lastElementChild;
            if (p.tagName !== "P") {
                p = document.createElement("p");
                lyrics.append(p);
            }
            if (/^>[ \t]*$/.test(line)) {
                let br = document.createElement("br");
                p.append(br);
            } else {
                let div = document.createElement("div");
                processLine(div, line.substr(1), style);
                p.append(div);
            }
        } else if (line.startsWith('######')) {
            let h6 = document.createElement("h6");
            processLine(h6, line.substr(6), style);
            lyrics.append(h6);
        } else if (line.startsWith('#####')) {
            let h5 = document.createElement("h5");
            processLine(h5, line.substr(5), style);
            lyrics.append(h5);
        } else if (line.startsWith('####')) {
            let h4 = document.createElement("h4");
            processLine(h4, line.substr(4), style);
            lyrics.append(h4);
        } else if (line.startsWith('###')) {
            let h3 = document.createElement("h3");
            processLine(h3, line.substr(3), style);
            lyrics.append(h3);
        } else if (line.startsWith('##')) {
            let h2 = document.createElement("h2");
            processLine(h2, line.substr(2), style);
            lyrics.append(h2);
        } else if (line.startsWith('#')) {
            let h1 = document.createElement("h1");
            processLine(h1, line.substr(1), style);
            lyrics.append(h1);
        } else if (/^[ \t]*$/.test(line)) {
            let br = document.createElement("br");
            lyrics.append(br);
        } else {
            let div = document.createElement("div");
            processLine(div, line, style);
            lyrics.append(div);
        }
    }
}

function videoLoadSkips(src) {
    let filename = src.substr(0, src.lastIndexOf("/") + 1) + "skip";
    skips = skipdb[filename];
    if (skips === null) return;
    if (skips) {
        let a = src.lastIndexOf("/");
        let b = src.lastIndexOf(".");
        let name = src.slice(a+1,b);
        for (let i = 0; i < skips.length; i++) {
            if (skips[i][0].test(name)) {
                skips = skips[i];
                return;
            }
        }
        skips = null;
        return;
    }
    skips = null;
    if (skip) return;
    if (library.lib.indexOf(filename.substr(filename.startsWith(library.prefix) ? library.prefix.length : 0)) === -1) {
        console.log("skip not found");
        skipdb[filename] = null;
        videoLoadSkips(src);
        return;
    }
    let script = document.createElement("script");
    skip = function(text){
        skip = null;
        script.remove();
        let lines = text.split("\n");
        skips = [];
        for (let i = 0; i < lines.length; i++) {
            let fields = lines[i].split('|');
            if (fields.length > 1) {
                let regexp = null;
                try {
                    regexp = RegExp(fields[0]);
                } catch (e) {
                    regexp = null;
                }
                if (regexp) {
                    let rule = [regexp];
                    for (let j = 1; j < fields.length; j++) {
                        let add = false;
                        let i = fields[j].indexOf('-');
                        if (i === -1) {
                            add = true;
                            i = fields[j].indexOf('+');
                        }
                        if (i !== -1) {
                            let numa = fromTimestamp(fields[j].substr(0,i));
                            let numb = fromTimestamp(fields[j].substr(i+1));
                            if (!Number.isNaN(numa) && !Number.isNaN(numb)) {
                                if (add) numb += numa;
                                rule.push([numa,numb]);
                            }
                        }
                    }
                    if (rule.length > 1) {
                        skips.push(rule);
                    }
                }
            }
        }
        skipdb[filename] = skips;
        videoLoadSkips(src);
    };
    script.src = filename;
    document.head.append(script);
}
function videoPlay(src) {
    if (audio) audio.pause();
    let file = filedb[src];
    document.body.classList.add("video");
    let videobox = document.getElementById("video");
    let video = document.createElement("video");
    let videoskip = document.createElement("div");
    let duration = null;
    let currentTime = 0;
    let skipi = 0;
    let autodismissid = undefined;
    function withinPeriod(time, duration, numa, numb) {
        if (numa < 0) numa += duration + 1;
        if (numb < 0) numb += duration + 1;
        if (numa < 0 || numb < 0) return false;
        if (numa < numb) {
            return numa <= time && time <= numb;
        } else {
            return numb <= time && time <= numa;
        }
    }
    function endofPeriod(duration, numa, numb) {
        if (numa < 0 && duration) numa += duration + 1;
        if (numb < 0 && duration) numb += duration + 1;
        return (numa > numb) ? numa : numb;
    }
    document.getElementById("videotitle").innerText = videoTitle(src);
    videoskip.id = "videoskip";
    for (let i = 0; i < 3; i++) {
        let videoskiparrow = document.createElement("span");
        videoskiparrow.innerText = ">";
        videoskiparrow.style.setProperty("--d", i);
        videoskip.append(videoskiparrow);
    }
    videoskip.addEventListener('click',function(){
        if (!skipi || !skips || !duration) return;
        video.currentTime = endofPeriod(duration,skips[skipi][0],skips[skipi][1]);
        videoskip.classList.remove("show");
    });
    videobox.dataset.src = src;
    while (videobox.lastElementChild) {
        videobox.lastElementChild.remove();
    }
    videoLoadSkips(src);
    video.volume = storage.get("global","videovolume",1,Number);
    video.setAttribute("src",src);
    video.setAttribute("autoplay","");
    video.setAttribute("controls","");
    video.addEventListener("loadeddata",onloadeddata);
    video.addEventListener("timeupdate",ontimeupdate);
    video.addEventListener("ended",onended);
    video.addEventListener("error",onerror);
    video.addEventListener("volumechange",onvolumechange);
    function onloadeddata() {
        duration = video.duration;
        storage.set("videod",src,duration);
        let ct = storage.get("video",src,0,Number) * duration;
        if (duration - ct < 10 || ct < 10) {
            // less than 10 seconds remaining till end
            // or less than 10 seconds from beginning
            ct = 0;
        }
        ct -= 3; // rewind 3 seconds
        if (ct < 0) ct = 0;
        video.currentTime = ct;
        currentTime = video.currentTime;
    }
    function ontimeupdate() {
        currentTime = video.currentTime;
        if (duration) {
            let ct = currentTime;
            if (ct < 10) {
                ct = 0;
            } else if (duration - ct < 10) {
                ct = duration;
            } else if (skips) {
                for (let i = 1; i < skips.length; i++) {
                    if (withinPeriod(ct,duration,skips[i][0],skips[i][1])) {
                        ct = endofPeriod(duration,skips[i][0],skips[i][1]);
                        break;
                    }
                }
            }
            if (file) {
                file.elem.style.setProperty("--v",(100 * ct / duration) + "%");
                file.elem.classList.remove("blink","full","empty");
            }
            storage.set("video",src,ct / duration);
        }
        if (skips) {
            let nskipi = 0;
            for (let i = 1; i < skips.length; i++) {
                if (withinPeriod(currentTime,duration,skips[i][0],skips[i][1])) {
                    nskipi = i;
                    break;
                }
            }
            if (skipi !== nskipi) {
                skipi = nskipi;
                clearTimeout(autodismissid);
                videoskip.classList.toggle("show",skipi);
                if (skipi) {
                    if (SKIP_BUTTON_TIMEOUT) {
                        autodismissid = setTimeout(function(){
                            videoskip.classList.remove("show");
                        },SKIP_BUTTON_TIMEOUT);
                    }
                } else {
                    autodismissid = undefined;
                }
            }
        }
    }
    function onended() {
        if (file) {
            file.elem.style.setProperty("--v","100%");
            file.elem.classList.remove("blink","full","empty");
        }
        storage.set("video",src,1);
        videoHide();
    }
    function onerror(ev) {
        console.log(ev);
    }
    function onvolumechange() {
        storage.set("global","videovolume",video.volume);
    }
    videobox.append(video,videoskip);
}
function videoGetDuration(src) {
    return new Promise(function(resolve) {
        let duration = storage.get("videod",src);
        if (typeof duration === "string") {
            return resolve(Number(duration));
        }
        let video = document.createElement('video');
        video.src = src;
        video.load();
        video.addEventListener("loadeddata",function(){
            if (!video) return;
            storage.set("videod",src,video.duration);
            resolve(video.duration);
            video.src = "";
            video = null;
        });
        video.addEventListener("error",function(){
            if (!video) return;
            resolve(null);
            video.src = "";
            video = null;
        });
    });
}
function videoGetProgress(src) {
    return storage.get("video",src,0);
}
function videoToggleProgress(src) {
    let file = filedb[src];
    if (storage.get("video",src,0,Number) === 0) {
        storage.set("video",src,1);
        if (file) {
            file.elem.style.setProperty('--v',"100%");
            file.elem.classList.add("blink");
            file.elem.classList.remove("empty","full");
            setTimeout(function(){
                file.elem.classList.add("full");
            },1);
        }
    } else {
        storage.set("video",src,0);
        if (file) {
            file.elem.style.setProperty('--v',"0%");
            file.elem.classList.add("blink");
            file.elem.classList.remove("empty","full");
            setTimeout(function(){
                file.elem.classList.add("empty");
            },1);
        }
    }
}
function videoHide() {
    let videobox = document.getElementById("video");
    while (videobox.lastElementChild) {
        videobox.lastElementChild.remove();
    }
    delete videobox.dataset.src;
    document.body.classList.add("loading");
    document.body.classList.remove("video");
    setTimeout(function(){
        document.body.classList.remove("loading");
    },BODY_LOADING_TIME);
}
function videoPlayNext(foward) {
    let videobox = document.getElementById("video");
    let src = videobox.dataset.src;
    if (!src.startsWith(library.prefix)) {
        return videoHide();
    }
    src = src.substr(library.prefix.length);
    let i = library.lib.indexOf(src);
    let j = foward ? i + 1 : i - 1;
    if (foward) {
        if (j === library.lib.length) return videoHide();
    } else {
        if (j === 0) return videoHide();
    }
    i = library.lib[i];
    j = library.lib[j];
    let a = i.lastIndexOf('/');
    let b = j.lastIndexOf('.');
    if (a !== j.lastIndexOf('/')) return videoHide();
    if (a !== -1 && i.substr(0,a) !== j.substr(0,a)) return videoHide();
    if (library.movie_ext.indexOf(j.substr(b+1)) === -1) return videoHide();
    return videoPlay(library.prefix + j);
}
function videoTitle(src) {
    let a = src.lastIndexOf("/");
    let b = src.lastIndexOf(".");
    if (b === -1) b = src.length;
    if (a === -1) return src.substr(0, b);
    let c = src.lastIndexOf("/", a - 1);
    return src.slice(c + 1, a) + " - " + src.slice(a + 1, b);
}

function setupEverything(){
	sortLibrary(library.lib);
    all = document.getElementById("all");
    document.body.classList.add(MOBILE ? "mobile" : "desktop");
    all.classList.add(MOBILE ? "mobile" : "desktop");
    storage = InitializeStorage();
    playlistPrepareDrop();
    let fs = createFileSystem();
    let playlistRoot = fs.addFolder('Playlists', storage.getb("folders-root","pl",false), function(isopen) {
        storage.setb("folders-root","pl",isopen);
    });
    let removeprevious = populatePlaylists(playlistRoot);
    repopulatePlaylists = function() {
        removeprevious();
        removeprevious = populatePlaylists(playlistRoot);
    };
    populateFilesystem(fs.addFolder('Library', storage.getb("folders-root","lib",true), function(isopen) {
        storage.setb("folders-root","lib",isopen);
    }));
    let filePadding = document.createElement("div");
    filePadding.classList.add("folder-padding");
    document.getElementById("filesystem").append(filePadding);
    setupAudio();
    document.getElementById("pledit").addEventListener('click', function(ev) {ev.stopPropagation();});
    document.getElementById("pledit").addEventListener('keydown', function(ev) {ev.stopPropagation();});
    function ctleditClick(){
        if (playlistLock === true || playlistLock === "unlocking") {
            playlistSetLock(false);
            return;
        }
        if (playlistLock === "locking") {
            playlistSetLock(true);
            return;
        }
        let plname = document.getElementById("plname");
        if (typeof plname.dataset.id !== "string") {
            showPLedit(plname.dataset.name || "Playlist",false,function(value) {
                if (typeof value === "string") createNewPlaylistStorage(value);
                playlistSetLock(true);
            }, function(value) {
                return value.indexOf(':') === -1;
            });
        } else {
            // edit existing
            function showdlg() {
                showPLedit(plname.dataset.name,true,function(value) {
                    if (value === true) {
                        showPLconfirm("Are you sure you want to delete\n" + plname.dataset.name, function(value) {
                            if (value) {
                                deletePlaylistStorage();
                            } else {
                                showdlg();
                            }
                        })
                        //console.log('delete #' + plname.dataset.id);
                    } else if (typeof value === "string") {
                        plname.innerText = value;
                        plname.dataset.name = value;
                        updatePlaylistStorage();
                        playlistSetLock(true);
                    }
                }, function(value) {
                    return value.indexOf(':') === -1;
                });
            }
            showdlg();
        }
        /*
        showPLedit("",true,function(value) {
            if (value === true) {
                // should delete
                showPLconfirm("Are you sure you want to delete this playlist?",function(value){
                    if (value) {
                        console.log("deleted");
                    }
                });
            } else if (typeof value === "string") {
                console.log("renamed to \"" + value + "\"");
            }
        }, e => e.startsWith("G") );
        return;
        */
    };
    let ctleditTimeout = 0;
    document.getElementById("ctledit").addEventListener('mousedown', function(ev) {
        if (playlistLock === false) {
            if (ctleditTimeout) clearTimeout(ctleditTimeout);
            ctleditTimeout = setTimeout(function () {
                playlistSetLock("locking");
                ctleditTimeout = 0;
            }, 500);
        } else if (playlistLock === true) {
            playlistSetLock("unlocking");
        }
    });
    document.getElementById("ctledit").addEventListener('mouseup', function(ev) {
        if (ctleditTimeout) {
            clearTimeout(ctleditTimeout);
            ctleditTimeout = 0;
        }
        ctleditClick();
    });
    document.getElementById("ctledit").addEventListener('touchstart', function(ev) {
        if (playlistLock === false) {
            if (ctleditTimeout) clearTimeout(ctleditTimeout);
            ctleditTimeout = setTimeout(function () {
                playlistSetLock("locking");
                ctleditTimeout = 0;
            }, 500);
        } else if (playlistLock === true) {
            playlistSetLock("unlocking");
        }
        ev.preventDefault();
    });
    document.getElementById("ctledit").addEventListener('touchend', function(ev) {
        if (ctleditTimeout) {
            clearTimeout(ctleditTimeout);
            ctleditTimeout = 0;
        }
        ctleditClick();
    });
    document.getElementById("ctlprevious").addEventListener('click', function(ev){
        playlistPlayPrevious(true);
        ev.preventDefault();
    });
    document.getElementById("ctlshuffle").classList.toggle('checked', storage.getb("global", "shuffle", false));
    document.getElementById("ctlshuffle").addEventListener('click', function(ev){
        storage.setb("global", "shuffle", this.classList.toggle('checked'));
        playlistClearPlayed();
        ev.preventDefault();
    });
    document.getElementById("ctlnext").addEventListener('click', function(ev){
        playlistPlayNext(true);
        ev.preventDefault();
    });
    document.getElementById("ctlclear").addEventListener('click', function(ev){
        playlistClearPlaylist();
        ev.preventDefault();
    });
    document.getElementById("ctlloop").classList.toggle('checked', storage.getb("global", "loop", false));
    document.getElementById("ctlloop").addEventListener('click', function(ev){
        storage.setb("global", "loop", this.classList.toggle('checked'));
        ev.preventDefault();
    });
    document.getElementById("ctleject").addEventListener('click', function(ev){
        playlistPlayNone();
        showLyrics(null);
        ev.preventDefault();
    });
    document.getElementById("lyricsclosebtn").addEventListener('click', function(ev) {
        showLyrics(null);
        ev.preventDefault();
    });
    document.getElementById("videotop").addEventListener('click',function(ev) {
        videoHide();
        ev.preventDefault();
    });
    document.getElementById("videonext").addEventListener('click',function(ev) {
        videoPlayNext(true);
        ev.preventDefault();
        ev.stopPropagation();
    });
    document.getElementById("videoprevious").addEventListener('click',function(ev) {
        videoPlayNext(false);
        ev.preventDefault();
        ev.stopPropagation();
    });
    setTimeout(function(){
        document.body.classList.remove("loading");
    },BODY_LOADING_TIME);
}

document.addEventListener("DOMContentLoaded",setupEverything);

function sortLibrary(arr) {
	function cmp(a,b) {
        let c = a.length;
        if (c > b.length) c = b.length;
        let i = 0;
        for (; i < c; i++)
            if (a.charCodeAt(i) != b.charCodeAt(i)) break;
        let pa = a.indexOf("/",i) === -1;
        let pb = b.indexOf("/",i) === -1;
        if (pa && !pb) return 1;
        if (!pa && pb) return -1;
        return a.toLowerCase() > b.toLowerCase() ? 1 : -1;
	}
	arr.sort(cmp);
}

function InitializeStorage(fake) {
    if (fake) return;
    let storage = localStorage;
    function set(section, key, value) {
        key = 'hmp_' + section + '_' + key;
        try {
            if (value === null || value === undefined) {
                storage.removeItem(key);
            } else {
                storage.setItem(key, value);   
            }
        } catch (e) {
            console.log(e);
            return false;
        }
        return true;
    }
    function get(section, key, defaultvalue, conversion) {
        key = 'hmp_' + section + '_' + key;
        let v = storage.getItem(key);
        if (v === null) return defaultvalue;
        if (typeof conversion === "function")
            return conversion(v);
        return v;
    }
    function setb(section, key, value) {
        key = 'hmp_' + section + '_' + key;
        try {
            if (value === null || value === undefined) {
                storage.removeItem(key);
            } else {
                storage.setItem(key, value ? 'T' : 'F');
            }
        } catch (e) {
            console.log(e);
            return false;
        }
        return true;
    }
    function getb(section, key, defaultvalue) {
        key = 'hmp_' + section + '_' + key;
        let v = storage.getItem(key);
        if (v === 'T') return true;
        if (v === 'F') return false;
        return defaultvalue;
    }
    return {set,get,setb,getb}
}

function yt() {
    return 'youtu.be/' + audio.src.substr(-15,11);
}
