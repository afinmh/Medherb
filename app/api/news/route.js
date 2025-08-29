import { NextResponse } from 'next/server';

export async function GET(request) {
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: 'News API key tidak terkonfigurasi di server.' },
            { status: 500 }
        );
    }

    // --- AWAL PERUBAHAN ---
    // Ambil 'page' dari query parameter URL, default ke halaman 1 jika tidak ada
    const page = request.nextUrl.searchParams.get('page') || '1';
    // --- AKHIR PERUBAHAN ---

    const query = 'obat tradisional OR tanaman obat OR pengobatan herbal OR herbal medicine OR jamu';
    const language = 'id';
    const pageSize = 9;
    const sortBy = 'publishedAt';

    // --- PERUBAHAN PADA URL ---
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=${language}&pageSize=${pageSize}&sortBy=${sortBy}&page=${page}&apiKey=${apiKey}`;
    // --- AKHIR PERUBAHAN ---

    try {
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json(
                { error: `Gagal mengambil berita: ${errorData.message}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Fetch Error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan internal saat menghubungi NewsAPI.' },
            { status: 500 }
        );
    }
}