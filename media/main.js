(function() {
    console.log("running");
    const vscode = acquireVsCodeApi();

    document.getElementById("new-post").addEventListener("click", function() {
        console.log("clicked");
        var title = document.getElementById("new-post-text").value;
        var date = document.getElementById("new-post-date").value;
        var permalink = document.getElementById("new-post-permalink").value;
        vscode.postMessage({"type":"newPost", "title":title, "permalink":permalink, "date":date});
    });
}());