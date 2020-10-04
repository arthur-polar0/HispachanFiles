'use strict';

const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const Feed = require('feed').Feed;
const axios = require('axios');

const parseThread = require('../../components/parsers/parseThread.js');
const parseBoard = require('../../components/parsers/parseBoard.js');

router.get('/', async (req, res) => {
    let response = {};

    try {
        response = await axios.get('https://www.hispasexy.org/h/');
    } catch ({ response }) {
        if (response.status === 404) {
            res.status(404).json({ status: 404 });
        } else {
            res.status(500).json({ status: 500 });
        }
        return;
    }

    const $ = cheerio.load(response.data);
    const board = $('body');

    if (board.find('input[name="board"]').length < 1) {
        res.status(404).json({ status: 404 });
        return;
    }

    const boardLinks = $('.barra').first().find('a.navbar-board');
    const boards = [];
    boardLinks.each((i, el) => {
        boards.push({
            board: $(el).attr('data-board-short-name'),
            path: $(el).attr('href'),
            title: $(el).attr('title'),
        });
    });

    res.json({ boards });
});

router.get('/:board/res/:th', async (req, res) => {
    const thId = req.params.th.split('.')[0];
    const board = req.params.board;
    let response = {};

    try {
        response = await axios.get(`https://www.hispasexy.org/${board}/res/${thId}.html`);
    } catch ({ response }) {
        if (response.status === 404) {
            res.status(404).json({ status: 404 });
        } else {
            res.status(500).json({ status: 500 });
        }
        return;
    }

    const $ = cheerio.load(response.data);
    const th = $('[id^="thread"]');

    if (th.length < 1) {
        res.status(404).json({ status: 404 });
        return;
    }

    res.json(parseThread(th.first(), $));
});

router.get('/catalog/:board', async (req, res) => {
    try {
        await axios.get(`https://www.hispasexy.org/${req.params.board}/`);
    } catch ({ response }) {
        if (response.status === 404) {
            res.status(404).json({ status: 404 });
        } else {
            res.status(500).json({ status: 500 });
        }
        return;
    }

    const data = [];

    for (const page of [0, 1, 2, 3, 4, 5, 6, 7]) {
        let response = {};

        try {
            response = await axios.get(`https://www.hispasexy.org/${req.params.board}/` + (page === 0 ? '' : `${page}.html`));
        } catch (error) {
            continue;
        }

        const $ = cheerio.load(response.data);
        const board = $('body');

        data.push(parseBoard(board, $, page));
    }

    res.json(data.sort((a, b) => a.page - b.page));
});

router.get('/:board/:page?', async (req, res) => {
    const page = req.params.page || 0;
    let response = {};

    try {
        response = await axios.get(`https://www.hispasexy.org/${req.params.board}/` + (page > 0 ? page + '.html' : ''));
    } catch ({ response }) {
        if (response.status === 404) {
            res.status(404).json({ status: 404 });
        } else {
            res.status(500).json({ status: 500 });
        }
        return;
    }

    const $ = cheerio.load(response.data);
    const board = $('body');

    if (board.find('input[name="board"]').length < 1) {
        res.status(404).json({ status: 404 });
        return;
    }

    res.json(parseBoard(board, $, page));
});

router.get('/:board/rss/:th', async (req, res) => {
    const thId = req.params.th.split('.')[0];
    const board = req.params.board;
    let response = {};

    try {
        response = await axios.get(`https://www.hispasexy.org/${board}/res/${thId}.html`);
    } catch ({ response }) {
        if (response.status === 404) {
            res.status(404).json({ status: 404 });
        } else {
            res.status(500).json({ status: 500 });
        }
        return;
    }

    const $ = cheerio.load(response.data);
    const th = $('[id^="thread"]');

    if (th.length < 1) {
        res.status(404).json({ status: 404 });
        return;
    }

    const data = parseThread(th.first(), $);

    const feed = new Feed({
        title: `/${data.board}/ - ${data.subject || data.message.substr(0, 40)}`,
        id: data.postId,
        link: `https://www.hispasexy.org/${board}/res/${thId}.html`,
        description: data.message,
        image: data.file ? data.file.thumb : undefined,
        favicon: 'https://www.hispasexy.org//favicon.ico',
    });

    data.replies.reverse().forEach(post => {
        feed.addItem({
            title: post.anonId || 'Anónimo',
            id: post.postId,
            link: `https://www.hispasexy.org/${board}/res/${thId}.html#${post.postId}`,
            description: post.message,
            content: post.message,
            date: post.date,
            image: post.file ? post.file.thumb : undefined,
        });
    });

    const post = data;
    feed.addItem({
        title: post.anonId || 'Anónimo',
        id: post.postId,
        link: `https://www.hispasexy.org/${board}/res/${thId}.html`,
        description: post.message,
        content: post.message,
        date: post.date,
        image: post.file ? post.file.thumb : undefined,
    });

    res.type('application/xml');
    res.send(feed.rss2());
});

module.exports = router;