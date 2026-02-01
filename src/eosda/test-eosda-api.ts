/**
 * EOSDA API Test Script
 * 
 * This script tests the EOSDA field creation API directly
 * Run with: npx ts-node src/eosda/test-eosda-api.ts
 * 
 * Tests multiple scenarios to verify EOSDA API integration
 */

import axios from 'axios';

const EOSDA_API_URL = 'https://api-connect.eos.com';
const EOSDA_API_KEY = process.env.EOSDA_API_KEY || 'apk.e23c5311bbd32bcf9e98da996c66ecaf45666ae102584e027b0a251b565206e3';

/**
 * Clean coordinates - remove elevation (3rd value) if present
 * EOSDA expects [lon, lat] format (2 values only)
 */
function cleanCoordinates(coordinates: any): any {
  if (Array.isArray(coordinates)) {
    if (coordinates.length === 0) {
      return coordinates;
    }
    
    // Check if first element is a number (this is a coordinate pair)
    if (typeof coordinates[0] === 'number') {
      // It's a coordinate pair [lon, lat, elevation?]
      // Return only [lon, lat]
      return [coordinates[0], coordinates[1]];
    }
    
    // It's an array of coordinates, recursively process
    return coordinates.map((coord: any) => cleanCoordinates(coord));
  }
  
  return coordinates;
}

/**
 * Test a single scenario
 */
async function testScenario(
  scenarioName: string,
  requestBody: any,
): Promise<{ success: boolean; fieldId?: string; error?: string }> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${scenarioName}`);
  console.log('='.repeat(70));

  try {
    const response = await axios.post(
      `${EOSDA_API_URL}/field-management`,
      requestBody,
      {
        headers: {
          'x-api-key': EOSDA_API_KEY,
          'Content-Type': 'application/json',
        },
      },
    );

    console.log('✅ SUCCESS!');
    console.log(`   Field ID: ${response.data.id}`);
    console.log(`   Area: ${response.data.area} hectares`);
    return { success: true, fieldId: response.data.id.toString() };
  } catch (error: any) {
    console.error('❌ FAILED');
    console.error(`   Status: ${error.response?.status || 'N/A'}`);
    
    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        console.error(`   Error: ${error.response.data.substring(0, 200)}`);
      } else {
        const errorMsg = JSON.stringify(error.response.data, null, 2);
        console.error(`   Error: ${errorMsg.substring(0, 300)}`);
      }
    }
    return { 
      success: false, 
      error: error.response?.data ? JSON.stringify(error.response.data) : error.message 
    };
  }
}

async function runTests() {
  console.log('\n🧪 EOSDA Field Creation API Test Suite');
  console.log('='.repeat(70));
  console.log(`API URL: ${EOSDA_API_URL}`);
  console.log(`API Key: ${EOSDA_API_KEY.substring(0, 8)}...\n`);

  // Test coordinates (from EOSDA example - must close polygon)
  const testCoordinates = [
    [
      [-104.87931347024973, 27.166227117387663],
      [-104.87190853064376, 27.17371136921598],
      [-104.87486446023671, 27.175686643908065],
      [-104.87271173924485, 27.178599422270565],
      [-104.87575466983847, 27.180525385046096],
      [-104.88103048496039, 27.176643443128853],
      [-104.87771956045358, 27.172771682872458],
      [-104.88236756436531, 27.17042134807906],
      [-104.87931347024973, 27.166227117387663], // Close polygon
    ],
  ];

  const cleanedCoordinates = cleanCoordinates(testCoordinates);

  const results: Array<{ name: string; success: boolean }> = [];

  // Test 1: Without years_data (optional)
  const scenario1 = {
    type: 'Feature',
    properties: {
      name: 'test-farm-no-crop',
      group: 'test-group',
    },
    geometry: {
      type: 'Polygon',
      coordinates: cleanedCoordinates,
    },
  };
  const result1 = await testScenario('Test 1: Without years_data (optional)', scenario1);
  results.push({ name: 'Without years_data', success: result1.success });

  // Test 2: With Wheat (documented example)
  const scenario2 = {
    type: 'Feature',
    properties: {
      name: 'test-farm-wheat',
      group: 'test-group',
      years_data: [
        {
          crop_type: 'Wheat',
          year: 2024,
          sowing_date: '2024-04-01',
        },
      ],
    },
    geometry: {
      type: 'Polygon',
      coordinates: cleanedCoordinates,
    },
  };
  const result2 = await testScenario('Test 2: With Wheat crop', scenario2);
  results.push({ name: 'Wheat crop', success: result2.success });

  // Test 3: With Soybeans (confirmed working)
  const scenario3 = {
    type: 'Feature',
    properties: {
      name: 'test-farm-soybeans',
      group: 'test-group',
      years_data: [
        {
          crop_type: 'Soybeans',
          year: 2024,
          sowing_date: '2024-04-01',
        },
      ],
    },
    geometry: {
      type: 'Polygon',
      coordinates: cleanedCoordinates,
    },
  };
  const result3 = await testScenario('Test 3: With Soybeans crop', scenario3);
  results.push({ name: 'Soybeans crop', success: result3.success });

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 Test Summary');
  console.log('='.repeat(70));
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.name}: ${status}`);
  });

  const passed = results.filter((r) => r.success).length;
  const total = results.length;
  console.log(`\n📈 Results: ${passed}/${total} tests passed\n`);

  if (passed === total) {
    console.log('🎉 All tests passed! EOSDA integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }
}

// Run all tests
runTests().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
