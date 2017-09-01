var app = require("./Generate");

app.default(
    {
        root: "/home/marc.thompson@tattsgroup.com/dev/proxygen",
        excludeDirs: [".git", "build", "cmake-build-debug", "CMakeFiles", ".idea"]
    }
    );