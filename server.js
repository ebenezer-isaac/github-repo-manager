const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const { Octokit } = require("@octokit/rest");
const { fetchRepositories } = require("./download-data");
require("dotenv").config();

const app = express();

// Set EJS as the view engine
app.set("view engine", "ejs");

app.use(bodyParser.json());
app.use(express.static("public"));
app.get("/", (req, res) => {
  // Read the file contents
  fetchRepositories(process.env.GH_USERNAME);
  const data = JSON.parse(fs.readFileSync("data.json", "utf8"));
  res.render("index", { repos: data });
});

const octokit = new Octokit({
  auth: process.env.GH_PAT,
});

console.log("Fetching data from GitHub...");
console.log(process.env.GH_USERNAME);
console.log(process.env.GH_PAT);

app.post("/update", async (req, res) => {
  const { name, description, file_presence, category, tags } = req.body;
  const data = JSON.parse(fs.readFileSync("data.json", "utf8"));
  const repo = data.find((r) => r.name === name);
  try {
    if (
      (repo && repo.description !== description) ||
      repo.file_presence !== file_presence ||
      repo.category !== category ||
      JSON.stringify(repo.tags) !== JSON.stringify(tags)
    ) {
      if (repo.description !== description) {
        console.log("Updating description");
        await octokit.repos.update({
          owner: process.env.GH_USERNAME,
          repo: repo.name,
          description: description,
        });
      }
      const filesInRepo = await octokit.repos.getContent({
        owner: process.env.GH_USERNAME,
        repo: repo.name,
        path: ".",
      });
      if (repo.file_presence !== file_presence) {
        const filesToKeep = [];
        if (file_presence === "common" || file_presence === "personal")
          filesToKeep.push(".personal");
        if (file_presence === "common" || file_presence === "mycrolinks")
          filesToKeep.push(".mycrolinks");
        for (const file of filesInRepo.data) {
          if (file.name === ".personal" || file.name === ".mycrolinks") {
            if (!filesToKeep.includes(file.name)) {
              await octokit.repos.deleteFile({
                owner: process.env.GH_USERNAME,
                repo: repo.name,
                path: file.name,
                message:
                  "GitHub Repo Manager Settings Update Visibility " +
                  new Date().toISOString(),
              });
            }
          }
        }
        // Add missing files
        if (file_presence === "common" || file_presence === "personal") {
          if (!filesInRepo.data.find((file) => file.name === ".personal")) {
            await octokit.repos.createOrUpdateFileContents({
              owner: process.env.GH_USERNAME,
              repo: repo.name,
              path: ".personal",
              message:
                "GitHub Repo Manager Settings Update Visibility " +
                new Date().toISOString(),
              content: Buffer.from("").toString("base64"),
            });
          }
        }
        if (file_presence === "common" || file_presence === "mycrolinks") {
          if (!filesInRepo.data.find((file) => file.name === ".mycrolinks")) {
            await octokit.repos.createOrUpdateFileContents({
              owner: process.env.GH_USERNAME,
              repo: repo.name,
              path: ".mycrolinks",
              message:
                "GitHub Repo Manager Settings Update Visibility " +
                new Date().toISOString(),
              content: Buffer.from("").toString("base64"),
            });
          }
        }
      }
      if (
        repo.category !== category ||
        JSON.stringify(repo.tags) !== JSON.stringify(tags)
      ) {
        console.log("Updating tags");
        console.log(
          !filesInRepo.data.find((file) => file.name === ".tags"),
          "file not found"
        );
        console.log(
          repo.category !== category,
          repo.category,
          category,
          "category not found"
        );
        console.log(
          JSON.stringify(repo.tags) !== JSON.stringify(tags),
          "tags not found"
        );
        console.log(JSON.stringify(repo.tags));
        console.log(JSON.stringify(tags));
        const file = filesInRepo.data.find((file) => file.name === ".tags");

        if (file) {
          // Get the content of the file, which includes its sha
          const fileContent = await octokit.repos.getContent({
            owner: process.env.GH_USERNAME,
            repo: repo.name,
            path: ".tags",
          });

          // Update the file
          await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GH_USERNAME,
            repo: repo.name,
            path: ".tags",
            message:
              "GitHub Repo Manager Settings Update Tags " +
              new Date().toISOString(),
            content: Buffer.from(category + "\n" + tags.join("\n")).toString(
              "base64"
            ),
            sha: fileContent.data.sha, // Use the sha from the file content
          });
        } else {
          // Create the file
          await octokit.repos.createOrUpdateFileContents({
            owner: process.env.GH_USERNAME,
            repo: repo.name,
            path: ".tags",
            message:
              "GitHub Repo Manager Settings Update Tags " +
              new Date().toISOString(),
            content: Buffer.from(category + "\n" + tags.join("\n")).toString(
              "base64"
            ),
            sha: null,
          });
        }
      }
      console.log("Updated repo", name);
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
