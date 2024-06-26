const { Octokit } = require("@octokit/rest");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const octokit = new Octokit({
  auth: process.env.GH_PAT, // GitHub Personal Access Token
});

// Function to fetch the content of a file in a repository
async function fetchFileContent(username, repo, filePath) {
  try {
    // Fetch the content of the file
    const content = await octokit.repos.getContent({
      owner: username,
      repo: repo.name,
      path: filePath,
    });

    // Check if content.data and content.data.content exist
    if (content.data && content.data.content) {
      // Decode the content from base64 and convert it to a string
      return Buffer.from(content.data.content, "base64").toString("utf8");
    } else {
      console.log(`No content found in ${filePath}`);
      return null;
    }
  } catch (error) {
    // Handle errors, excluding 404 errors (file not found)
    if (error.status !== 404) {
      console.error(error);
    }
  }
}

// Function to check the presence of specific files in the repository content
function checkFilePresence(repoContent) {
  const files = ["personal", "mycrolinks"];
  const tags = [];
  files.forEach((file) => {
    if (repoContent && repoContent[file] !== null) {
      tags.push(file);
    }
  });
  if (tags.length === 2) {
    return "common"; // Both files present
  } else if (tags.length === 1) {
    return tags[0]; // Only one file present
  } else {
    return "private"; // No files present
  }
}

// Function to extract tags from repository content
function getTags(repoContent) {
  // Check if repository content or "tags" file is missing
  if (!repoContent || !repoContent["tags"]) {
    return []; // No tags present
  }

  // Split the content by newline character and trim each tag
  const tags = repoContent["tags"].split("\n").map((tag) => tag.trim());

  return tags;
}

// Function to fetch repositories for a given username
async function fetchAndSortRepos() {
  // Fetch all repositories for the authenticated user
  const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    visibility: "all",
  });

  // Sort the repositories alphabetically by name
  repos.sort((a, b) => a.name.localeCompare(b.name));

  // Return the sorted repositories
  return repos;
}

// Function to fetch the content of a repository
async function fetchRepoContent(username, repo) {
  // Fetch the content of the ".tags", ".personal", and ".mycrolinks" files
  const tagsContent = await fetchFileContent(username, repo, ".tags");
  const personalContent = await fetchFileContent(username, repo, ".personal");
  const mycrolinksContent = await fetchFileContent(
    username,
    repo,
    ".mycrolinks"
  );

  // Return an object with the content of each file
  return {
    tags: tagsContent,
    personal: personalContent,
    mycrolinks: mycrolinksContent,
  };
}

async function processRepo(username, repo) {
  // Log the repository being processed
  console.log("Processing repository:", repo.name);

  // Fetch the content of the repository
  const repoContent = await fetchRepoContent(username, repo);

  // Extract the tags from the repository content
  let tags = getTags(repoContent);
  console.log(tags);

  // Extract the category from the tags
  const category = tags[0] || "";

  // Remove the category from the tags
  tags = tags.slice(1);

  // Check the presence of specific files in the repository content
  const filePresence = checkFilePresence(repoContent);
  console.log(filePresence);

  // Return the processed repository object
  return {
    name: repo.name,
    html_url: repo.html_url,
    description: repo.description,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    visibility: repo.private ? "private" : "public",
    file_presence: filePresence,
    category: category,
    tags: tags,
  };
}

// Function to fetch repositories for a given username
async function fetchRepositories(username) {
  try {
    // Fetch and sort the repositories for the specified username
    const repos = await fetchAndSortRepos(username);

    // Process each repository asynchronously
    const allRepos = await Promise.all(
      repos.map((repo) => processRepo(username, repo))
    );

    // Write the processed repository data to a JSON file
    fs.writeFile("data.json", JSON.stringify(allRepos), (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log("Data saved to data.json");
        console.log("Total number of repositories: ", allRepos.length);
      }
    });
  } catch (error) {
    console.error(error);
  }
}

// Export the fetchRepositories function
module.exports = {
  fetchRepositories,
};
