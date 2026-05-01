import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { initDb } from './src/services/puzzleStore';
import { HomeScreen } from './src/screens/HomeScreen';
import { WordleScreen } from './src/screens/WordleScreen';
import { ConnectionsScreen } from './src/screens/ConnectionsScreen';
import { StrandsScreen } from './src/screens/StrandsScreen';
import { MiniScreen } from './src/screens/MiniScreen';
import type { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const NYT_S = process.env.NYT_S;
const NYT_A = process.env.NYT_A;

export default function App() {
  useEffect(() => {
    initDb().catch(console.error);
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home">
          {props => <HomeScreen {...props} nytS={NYT_S} nytA={NYT_A} />}
        </Stack.Screen>
        <Stack.Screen name="Wordle" component={WordleScreen} />
        <Stack.Screen name="Connections" component={ConnectionsScreen} />
        <Stack.Screen name="Strands" component={StrandsScreen} />
        <Stack.Screen name="Mini" component={MiniScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
