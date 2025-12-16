https://contextarea.com/consider-this-lib-ht-86pg8ii5v3k0xn

consider this lib https://pastebin.contextarea.com/72H3FFqKYYv1NN9.md

create a script that allows parsing the markdown into llms.txt parsed using the library.

then, in lib.js, given a url, it should download all links and return a file object structured like {[path:string]:string}. the file/folder-name should be based on the section as well as the pathname of the url (sanitised)

then, a cli.js can wrap the lib to take the url as the first argument, and write the output to the fs in current working directory (or, if given, in the second argument's location)

give me lib, cli, and package.json
