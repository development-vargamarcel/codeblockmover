Move code block (called source block) bellow or above another code block (called destination block) in every file contained in the selected folder and its subfolders.

Both code block types can be targetted usign regex or providing the startOfString and endOfString like this:

startOfString ... endOfString

Example:

If i have this code block:

```
<script src="https://gist.github.com/username/gist-id.js">
a

dsghdhj ds

i want to move this code block right bellow
the `<script src="https://gist.github.com/username/gist-id.js">` line.
</script>
```

And i provide these values:
source block: <script ... >
destination block: i want ... line.

I will get this code block:

```
<script src="https://gist.github.com/username/gist-id.js">
i want to move this code block right bellow
the `<script src="https://gist.github.com/username/gist-id.js">` line.
a

dsghdhj ds


</script>
```
