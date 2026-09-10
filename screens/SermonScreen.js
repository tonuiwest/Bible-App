import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import ParchmentBackground from '../components/ParchmentBackground';
import PersistentBanner from '../components/PersistentBanner';
import ThemeToggle from '../components/ThemeToggle';
import ScreenHeader from '../components/ScreenHeader';
import { useContentBottomPad } from '../components/useContentBottomPad';
import Ionicons from '@expo/vector-icons/Ionicons';
import { generateDevotional } from '../utils/aiBible';

export default function SermonScreen(){
  const theme=useTheme(); const colors=theme?.colors; const fonts=theme?.fonts; const navigation=useNavigation();
  const bottomPad = useContentBottomPad(40);
  const [topic,setTopic]=useState(''); const [sermon,setSermon]=useState(''); const [verses,setVerses]=useState([]); const [loading,setLoading]=useState(false);

  const generate = async()=>{
    if(!topic.trim()) return;
    setLoading(true);
    try {
      const res = await generateDevotional(topic.trim());
      setSermon(res.content);
      setVerses(res.verses || (res.verse ? [res.verse] : []));
    } catch (e) {
      setSermon('Something went wrong generating this. Please try again.');
      setVerses([]);
    }
    setLoading(false);
  };

  if(!colors) return null;
  return (
    <ParchmentBackground>
      <ScreenHeader title="SERMON WRITER" onBack={()=>navigation.goBack()} right={<ThemeToggle size={14} />} />
      <ScrollView style={{flex:1}} contentContainerStyle={{padding:16, paddingBottom: bottomPad}}>
        <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
          <Text style={{color: colors.gold, fontSize:10, letterSpacing:1, fontFamily: fonts?.sansBold}}>SERMON TOPIC</Text>
          <View style={[styles.inputBox, {backgroundColor: colors.background, borderColor: colors.border}]}>
            <TextInput value={topic} onChangeText={setTopic} placeholder="e.g. Finding Peace in Anxiety" placeholderTextColor={colors.textSecondary} style={{color: colors.textPrimary, fontFamily: fonts?.sans}} />
          </View>
          <TouchableOpacity onPress={generate} style={[styles.btn, {backgroundColor: colors.primary}]}><Text style={{color: theme.isDark?colors.background:'#fff', fontFamily: fonts?.sansBold}}>Generate Sermon</Text></TouchableOpacity>
        </View>
        {loading && <ActivityIndicator color={colors.gold} style={{marginTop:20}} />}
        {sermon!=='' && (
          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border, marginTop:12}]}>
            <Text style={{color: colors.textPrimary, lineHeight:22, fontFamily: fonts?.serif}}>{sermon}</Text>
            {verses.length>0 && (
              <View style={{flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:12}}>
                {verses.map((v,i)=>(
                  <View key={i} style={{borderWidth:1, borderColor: colors.border, borderRadius:8, paddingHorizontal:8, paddingVertical:4, backgroundColor: colors.background}}>
                    <Text style={{fontSize:10, color: colors.gold, fontWeight:'700'}}>{v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <PersistentBanner />
    </ParchmentBackground>
  );
}
const styles=StyleSheet.create({header:{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:14, borderBottomWidth:1}, card:{borderWidth:1, borderRadius:14, padding:14}, inputBox:{borderWidth:1, borderRadius:10, padding:12, marginTop:10}, btn:{padding:14, borderRadius:10, alignItems:'center', marginTop:12}});
