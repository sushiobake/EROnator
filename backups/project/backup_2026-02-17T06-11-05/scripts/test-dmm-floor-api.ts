#!/usr/bin/env tsx
/**
 * DMM Affiliate API - フロアAPIテスト
 * FANZAの全フロアを取得し、漫画関連のフロアを特定
 * 
 * 使い方:
 *   tsx scripts/test-dmm-floor-api.ts
 * 
 * 環境変数:
 *   DMM_API_ID: DMM API ID
 *   DMM_AFFILIATE_ID: アフィリエイトID (末尾990-999)
 */

import dotenv from 'dotenv';
import path from 'path';

// .env.localを優先的に読み込む（既存の環境変数を上書きしない）
const envLocal = dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
dotenv.config(); // .envも読み込む（フォールバック、既存の環境変数を上書きしない）

// デバッグ: 読み込まれた環境変数を確認
if (envLocal.parsed) {
  console.log('[dotenv] .env.localから読み込んだDMM_AFFILIATE_ID:', envLocal.parsed.DMM_AFFILIATE_ID);
}

interface FloorParameter {
  name: string;
  value: string;
}

interface Floor {
  id: number;
  name: string;
  code: string;
}

interface Service {
  name: string;
  code: string;
  floor: Floor[];
}

interface Site {
  name: string;
  code: string;
  service: Service[];
}

interface FloorListResponse {
  request: {
    parameters: {
      parameter: FloorParameter[];
    };
  };
  result: {
    site: Site[];
  };
}

async function fetchFloorList(apiId: string, affiliateId: string): Promise<FloorListResponse> {
  const url = `https://api.dmm.com/affiliate/v3/FloorList?api_id=${encodeURIComponent(apiId)}&affiliate_id=${encodeURIComponent(affiliateId)}&output=json`;
  
  console.log(`[API] Requesting floor list...`);
  console.log(`[API] URL: ${url.replace(apiId, '***').replace(affiliateId, '***')}`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json() as FloorListResponse;
  
  return data;
}

function findComicFloors(sites: Site[]): Array<{ site: string; service: string; floor: Floor }> {
  const comicKeywords = ['漫画', 'コミック', '同人', 'comic', 'book', '電子書籍', 'ebook'];
  const comicFloors: Array<{ site: string; service: string; floor: Floor }> = [];
  
  for (const site of sites) {
    for (const service of site.service) {
      for (const floor of service.floor) {
        const floorNameLower = floor.name.toLowerCase();
        const floorCodeLower = floor.code.toLowerCase();
        
        const isComic = comicKeywords.some(keyword => 
          floorNameLower.includes(keyword.toLowerCase()) || 
          floorCodeLower.includes(keyword.toLowerCase())
        );
        
        if (isComic) {
          comicFloors.push({
            site: site.name,
            service: service.name,
            floor: floor,
          });
        }
      }
    }
  }
  
  return comicFloors;
}

function displayAllFloors(sites: Site[]) {
  console.log('\n=== 全フロア一覧 ===\n');
  
  for (const site of sites) {
    console.log(`[${site.name} (${site.code})]`);
    
    for (const service of site.service) {
      console.log(`  └─ ${service.name} (${service.code})`);
      
      for (const floor of service.floor) {
        console.log(`      └─ ${floor.name} (code: ${floor.code}, id: ${floor.id})`);
      }
    }
    console.log('');
  }
}

function displayComicFloors(comicFloors: Array<{ site: string; service: string; floor: Floor }>) {
  if (comicFloors.length === 0) {
    console.log('\n⚠️  漫画関連のフロアが見つかりませんでした。');
    console.log('   キーワードを調整するか、手動でフロアを確認してください。\n');
    return;
  }
  
  console.log('\n=== 漫画関連フロア（候補） ===\n');
  
  for (const item of comicFloors) {
    console.log(`[${item.site}]`);
    console.log(`  サービス: ${item.service}`);
    console.log(`  フロア名: ${item.floor.name}`);
    console.log(`  フロアコード: ${item.floor.code}`);
    console.log(`  フロアID: ${item.floor.id}`);
    console.log('');
  }
  
  console.log('💡 商品情報APIで使用するパラメータ:');
  console.log(`   site: FANZA`);
  console.log(`   service: digital (または該当するサービスコード)`);
  console.log(`   floor: ${comicFloors[0]?.floor.code} (上記のフロアコード)`);
  console.log('');
}

async function main() {
  const apiId = process.env.DMM_API_ID;
  // DMM_AFFILIATE_IDが設定されていない場合、AFFILIATE_IDを試す
  let affiliateId = process.env.DMM_AFFILIATE_ID || process.env.AFFILIATE_ID;

  // デバッグ: 環境変数の確認
  console.log('現在の環境変数確認:');
  console.log(`DMM_API_ID: ${apiId ? '設定済み' : '未設定'}`);
  console.log(`DMM_AFFILIATE_ID: ${process.env.DMM_AFFILIATE_ID ? process.env.DMM_AFFILIATE_ID : '未設定'}`);
  console.log(`AFFILIATE_ID: ${process.env.AFFILIATE_ID ? process.env.AFFILIATE_ID : '未設定'}`);
  console.log(`使用するaffiliateId: ${affiliateId}`);
  console.log('');

  if (!apiId) {
    console.error('❌ エラー: DMM_API_IDが設定されていません');
    console.error('   .envファイルに以下を追加してください:');
    console.error('   DMM_API_ID=your-api-id');
    process.exit(1);
  }

  if (!affiliateId) {
    console.error('❌ エラー: アフィリエイトIDが設定されていません');
    console.error('   .envファイルに以下を追加してください:');
    console.error('   DMM_AFFILIATE_ID=sok-001');
    console.error('   または');
    console.error('   AFFILIATE_ID=sok-001');
    process.exit(1);
  }

  // affiliate_idの末尾チェック（警告のみ、実際のAPIで確認）
  // 注意: APIリファレンスでは末尾990-999が必要とされていますが、
  // 実際の形式はアカウントによって異なる可能性があります
  if (!affiliateId.match(/990$|991$|992$|993$|994$|995$|996$|997$|998$|999$/)) {
    console.warn('⚠️  警告: affiliate_idの末尾が990-999ではありません');
    console.warn(`   現在の値: ${affiliateId}`);
    console.warn('   APIリファレンスでは末尾990-999が必要とされていますが、');
    console.warn('   実際にAPIを呼び出して確認します。');
    console.warn('   エラーが出る場合は、DMM Affiliate管理画面でAPI用のアフィリエイトIDを確認してください。\n');
  }

  try {
    console.log('🚀 DMM Affiliate API - フロアAPIテスト\n');
    
    const data = await fetchFloorList(apiId, affiliateId);
    
    // 全フロアを表示
    displayAllFloors(data.result.site);
    
    // 漫画関連フロアを特定
    const comicFloors = findComicFloors(data.result.site);
    displayComicFloors(comicFloors);
    
    // FANZAサイトのみを詳しく表示
    const fanzaSite = data.result.site.find(s => s.code === 'FANZA');
    if (fanzaSite) {
      console.log('=== FANZAサイトの詳細 ===\n');
      for (const service of fanzaSite.service) {
        console.log(`サービス: ${service.name} (${service.code})`);
        console.log(`  フロア数: ${service.floor.length}`);
        console.log(`  フロア一覧:`);
        for (const floor of service.floor) {
          console.log(`    - ${floor.name} (code: ${floor.code}, id: ${floor.id})`);
        }
        console.log('');
      }
    }
    
    console.log('✅ テスト完了\n');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
    }
    process.exit(1);
  }
}

main();
