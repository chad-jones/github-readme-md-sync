# ReadMe GitHub Markdown Sync

A GitHub action for syncing markdown files to ReadMe

With [GitHub Actions](https://github.com/features/actions) it's super easy to automatically sync your markdown documents whenever changes occur in your GitHub repo.

## Setup
Just copy and paste the following into `.github/workflows/readme-md-sync.yml`. You only need to modify three of the parameters in the GitHub Action—the path to sync (leave blank to scan the entire repo), your ReadMe project's API key, and the [ReadMe version](doc:versions) you want to upload to. Your ReadMe API key should be stored as a secret `README_API_KEY` in your github repo. 

Once that is done you should be good to go! Any subsequent commits to master will automatically start the sync process and sync your specified files to ReadMe.

```
name: Sync to ReadMe
on:
  push:
    branches:
      - master
  watch:
    types: [started]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: chad-jones/github-readme-md-sync@1.0.0
      with:
        repo-token: '${{ secrets.GITHUB_TOKEN }}' # DON'T MODIFY--Allows us to get the contents of your repo
        file-path: '' # path to markdown files
        readme-api-key: '${{ secrets.README_API_KEY }}' # ReadMe API key 
        readme-api-version: '1.0' # ReadMe version to sync to
```

## Meta data (front-matter)
Only markdown files containing the appropriate metadata at the begging of the file can be synced. The `title` and `category` are required. The `category` must already exist in ReadMe. Visibility of the page is determined by `hidden`. 

```
---
title: "My awesome document"
category: "Getting started"
hidden: false
---
```

