const NOTION_TOKEN = process.env.NOTION_TOKEN
const DB_ID = process.env.NOTION_PROJECTS_DB_ID

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
  const { name } = req.query
  if (!name) return res.status(400).json({ error: 'name required' })

  try {
    const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'Project name', title: { contains: name } },
        page_size: 1,
      }),
    })
    const { results } = await r.json()
    if (!results?.length) return res.json({ project: null })

    const p = results[0].properties
    res.json({
      project: {
        notionId:        results[0].id,
        status:          p['Status']?.status?.name ?? '',
        progress:        p['Progress']?.number ?? null,
        clientUpdate:    p['Client Updates']?.rich_text?.[0]?.plain_text ?? '',
        sitePackage:     p['Site Package']?.select?.name ?? '',
        wixUrl:          p['Wix Site URL']?.url ?? '',
        onboarded:       p['Onboarded']?.date?.start ?? null,
        projectStart:    p['Project Start date']?.date?.start ?? null,
        projectFinished: p['Project Finished']?.date?.start ?? null,
        filloutFormLink: p['Fillout Form Link']?.formula?.string ?? null,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
