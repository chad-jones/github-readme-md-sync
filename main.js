const core = require('@actions/core')
const github = require('@actions/github')
const request = require('request-promise-native')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const frontMatter = require('gray-matter')

async function run () {
  try {
    const readmeKey = core.getInput('readme-api-key', { required: true })
    const filePath = core.getInput('file-path', { required: false })
    const apiVersion = core.getInput('readme-api-version', { required: true })
    const token = core.getInput('repo-token', { required: true })

    const client = new github.GitHub(token)

    const options = {
      headers: {
        'x-readme-version': apiVersion,
        'x-readme-source': 'github'
      },
      auth: { user: readmeKey },
      resolveWithFullResponse: true
    }
    // get file-path
    const repoFiles = await client.repos.getContents({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      path: filePath,
      ref: github.context.ref
    })
    // get files recursively
    for (let file in repoFiles.data) {
      if (repoFiles.data[file].type === 'dir') {
        let dir = await client.repos.getContents({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          path: repoFiles.data[file].path,
          ref: github.context.ref
        })
        repoFiles.data.push(...dir.data)
      }
    }
    // filter markdown files
    const files = repoFiles.data.filter((file) => file.name.endsWith('.md') || file.name.endsWith('.markdown'))

    function validationErrors (err) {
      if (err.statusCode === 400) {
        core.setFailed(err.message)
        return Promise.reject(err.error)
      }
      core.setFailed(err.message)
      return Promise.reject(err)
    }
    // create readme.io doc
    function createDoc (slug, file, hash, err) {
      if (err.statusCode !== 404) return Promise.reject(err.error)

      return request
        .post(`https://dash.readme.io/api/v1/docs`, {
          json: { slug, body: file.content, ...file.data, lastUpdatedHash: hash },
          ...options
        })
        .then(core.info(file.data.title + ` was succesfully created to /api/v1/docs/${slug}`))
        .catch(validationErrors)
    }
    // update readme.io doc
    function updateDoc (slug, file, hash, existingDoc) {
      if (hash === existingDoc.body.lastUpdatedHash) {
        core.info(`\'${file.data.title}\' not updated. No changes.`)
        return
      }
      return request
        .put(`https://dash.readme.io/api/v1/docs/${slug}`, {
          json: Object.assign(existingDoc, {
            body: file.content,
            ...file.data,
            lastUpdatedHash: hash
          }),
          ...options
        })
        .then(core.info(`\'${file.data.title}\'` + ` was succesfully updated to /api/v1/docs/${slug}`))
        .catch(validationErrors)
    }

    return Promise.all(
      files.map(async (gitFile) => {
        const markdown = await client.repos.getContents({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          path: gitFile.path,
          ref: github.context.ref
        })
        // Trim off the refs/heads from the github html_url
        const url = markdown.data.html_url.replace('refs/heads/', '')
        // Add source link to end of file
        const footer = `\n  \n***  \nSource: [${url}](${url}\n)`
        const file = Buffer.from(markdown.data.content, 'base64').toString('utf8') + footer
        const matter = frontMatter(file)
        // Ignore markdown files missing front-matter title or category
        if (!matter.data.hasOwnProperty('title') || !matter.data.hasOwnProperty('category')) {
          core.warning(markdown.data.path + ' was not synced (missing title/category front-matter)')
          return
        }
        // get category id
        const category = await request
          .get(`https://dash.readme.io/api/v1/categories/${matter.data.category.replace(/\s+/g, '-').toLowerCase()}`, {
            json: true,
            ...options
          })
          .catch(validationErrors)
        matter.data.category = category.body._id
        // Slug from repo + filename
        const filenameNoExt = markdown.data.name.replace(path.extname(markdown.data.name), '')
        const slug = (github.context.repo.repo + '-' + filenameNoExt).replace(/\s+/g, '-').toLowerCase()
        const hash = crypto.createHash('sha1').update(file).digest('hex')

        return request
          .get(`https://dash.readme.io/api/v1/docs/${slug}`, {
            json: true,
            ...options
          })
          .then(updateDoc.bind(null, slug, matter, hash), createDoc.bind(null, slug, matter, hash))
          .catch((err) => {
            return Promise.reject(err)
          })
      })
    )
  } catch (err) {
    core.setFailed(err.message)
  }
}

run()
